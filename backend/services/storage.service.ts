import { google } from 'googleapis';
import { Readable } from 'stream';
import { query } from '../database/postgres';

export interface StorageUploadOptions {
  name: string;
  mimeType: string;
  folderId?: string;
}

export interface CloudStorageProvider {
  uploadFile(
    userId: string,
    data: Buffer,
    options: StorageUploadOptions,
    credentials?: { accessToken: string | null; refreshToken: string | null; email?: string }
  ): Promise<{ driveLocation: string; status: 'success' | 'failed' }>;
}

/**
 * Google Drive Storage Provider
 */
export class GoogleDriveStorageProvider implements CloudStorageProvider {
  async uploadFile(
    userId: string,
    data: Buffer,
    options: StorageUploadOptions,
    credentials?: { accessToken: string | null; refreshToken: string | null; email?: string }
  ): Promise<{ driveLocation: string; status: 'success' | 'failed' }> {
    const { name, mimeType } = options;
    const { accessToken, refreshToken, email } = credentials || {};

    const isMock = process.env.GOOGLE_CLIENT_ID === 'MOCK_CLIENT_ID' || !process.env.GOOGLE_CLIENT_ID || !accessToken;

    if (isMock) {
      console.log('[Storage] Running in Mock Google Drive backup mode');
      return {
        driveLocation: `mock_drive/appDataFolder/${name}`,
        status: 'success'
      };
    }

    try {
      // Initialize OAuth2 client
      const client = new google.auth.OAuth2(
        process.env.GOOGLE_CLIENT_ID,
        process.env.GOOGLE_CLIENT_SECRET,
        process.env.GOOGLE_REDIRECT_URI
      );
      client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
      });

      // Set up listener to save refreshed tokens automatically
      client.on('tokens', async (newTokens) => {
        if (newTokens.access_token) {
          if (email) {
            await query(
              `UPDATE oauth_tokens 
               SET encrypted_token = $1, expires_at = $2
               WHERE user_id = $3 AND email = $4 AND service = 'google'`,
              [newTokens.access_token, newTokens.expiry_date ? new Date(newTokens.expiry_date) : null, userId, email]
            );
          }
          await query(
            `UPDATE users 
             SET google_access_token = $1, updated_at = CURRENT_TIMESTAMP
             WHERE id = $2`,
            [newTokens.access_token, userId]
          );
        }
      });

      const drive = google.drive({ version: 'v3', auth: client });

      // Search if name already exists in appDataFolder
      let fileId: string | null = null;
      try {
        const listRes = await drive.files.list({
          q: `name = '${name}' and 'appDataFolder' in parents and trashed = false`,
          spaces: 'appDataFolder',
          fields: 'files(id, name)',
        });
        if (listRes.data.files && listRes.data.files.length > 0) {
          fileId = listRes.data.files[0].id || null;
        }
      } catch (e) {
        console.warn('[Storage] Error searching for file on Google Drive:', e);
      }

      const media = {
        mimeType,
        body: Readable.from(data)
      };

      if (fileId) {
        // Overwrite existing file
        const updateRes = await drive.files.update({
          fileId,
          media,
        });
        return {
          driveLocation: `google_drive/appDataFolder/${name}?id=${updateRes.data.id}`,
          status: 'success'
        };
      } else {
        // Create new file in appDataFolder
        const createRes = await drive.files.create({
          requestBody: {
            name,
            parents: ['appDataFolder']
          },
          media,
        });
        return {
          driveLocation: `google_drive/appDataFolder/${name}?id=${createRes.data.id}`,
          status: 'success'
        };
      }
    } catch (error) {
      console.error('[Storage] Google Drive upload failed:', error);
      throw error;
    }
  }
}

/**
 * AWS S3 Storage Provider (Skeleton / Placeholder for future S3 integration)
 */
export class S3StorageProvider implements CloudStorageProvider {
  async uploadFile(
    userId: string,
    data: Buffer,
    options: StorageUploadOptions
  ): Promise<{ driveLocation: string; status: 'success' | 'failed' }> {
    // S3 upload integration skeleton
    // To activate in the future:
    // 1. Install @aws-sdk/client-s3
    // 2. Instantiate S3 client and upload key
    console.log('[Storage] Running in AWS S3 backup mode (skeleton)');
    
    // Example implementation:
    // const client = new S3Client({ region: process.env.AWS_REGION });
    // await client.send(new PutObjectCommand({ Bucket: process.env.S3_BUCKET_NAME, Key: `${userId}/${options.name}`, Body: data }));

    return {
      driveLocation: `s3://${process.env.S3_BUCKET_NAME || 'base-app-backups'}/${userId}/${options.name}`,
      status: 'success'
    };
  }
}

/**
 * Get active storage provider based on environment variables
 */
export const getStorageProvider = (): CloudStorageProvider => {
  const providerType = process.env.STORAGE_PROVIDER || 'google_drive';

  switch (providerType.toLowerCase()) {
    case 's3':
      return new S3StorageProvider();
    case 'google_drive':
    default:
      return new GoogleDriveStorageProvider();
  }
};

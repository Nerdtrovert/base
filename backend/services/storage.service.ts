import { Readable } from 'stream';
import { createGoogleOAuthClient, attachGoogleTokenPersistence, isMockGoogleConfigured } from './google.service';

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
  downloadFile(
    userId: string,
    name: string,
    credentials?: { accessToken: string | null; refreshToken: string | null; email?: string }
  ): Promise<Buffer | null>;
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

    const isMock = isMockGoogleConfigured() || (!accessToken && !refreshToken);

    if (isMock) {
      console.log('[Storage] Running in Mock Google Drive backup mode');
      return {
        driveLocation: `mock_drive/appDataFolder/${name}`,
        status: 'success'
      };
    }

    try {
      const client = createGoogleOAuthClient();
      client.setCredentials({
        access_token: accessToken || undefined,
        refresh_token: refreshToken || undefined
      });

      if (email) {
        attachGoogleTokenPersistence(client, userId, email);
      }

      const { google } = await import('googleapis');
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

  async downloadFile(
    userId: string,
    name: string,
    credentials?: { accessToken: string | null; refreshToken: string | null; email?: string }
  ): Promise<Buffer | null> {
    const { accessToken, refreshToken, email } = credentials || {};
    const isMock = isMockGoogleConfigured() || (!accessToken && !refreshToken);

    if (isMock) {
      console.log('[Storage] Running in Mock Google Drive restore mode');
      return null;
    }

    try {
      const client = createGoogleOAuthClient();
      client.setCredentials({
        access_token: accessToken || undefined,
        refresh_token: refreshToken || undefined
      });

      if (email) {
        attachGoogleTokenPersistence(client, userId, email);
      }

      const { google } = await import('googleapis');
      const drive = google.drive({ version: 'v3', auth: client });

      // Find the file in appDataFolder
      const listRes = await drive.files.list({
        q: `name = '${name}' and 'appDataFolder' in parents and trashed = false`,
        spaces: 'appDataFolder',
        fields: 'files(id, name)',
      });

      if (!listRes.data.files || listRes.data.files.length === 0) {
        return null;
      }

      const fileId = listRes.data.files[0].id;
      if (!fileId) return null;

      // Download the file content as an ArrayBuffer/Buffer
      const downloadRes = await drive.files.get({
        fileId,
        alt: 'media'
      }, { responseType: 'arraybuffer' });

      return Buffer.from(downloadRes.data as ArrayBuffer);
    } catch (error) {
      console.error('[Storage] Google Drive download failed:', error);
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

  async downloadFile(
    userId: string,
    name: string
  ): Promise<Buffer | null> {
    console.log('[Storage] Running in AWS S3 download mode (skeleton)');
    return null;
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

import { Pool, PoolClient } from 'pg';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config();

const useConnectionString = Boolean(process.env.DATABASE_URL);
const connectionConfig = useConnectionString
  ? { connectionString: process.env.DATABASE_URL }
  : {
      host: process.env.PGHOST || 'localhost',
      port: Number(process.env.PGPORT || 5432),
      database: process.env.PGDATABASE || 'base_db',
      user: process.env.PGUSER || 'postgres',
      password: process.env.PGPASSWORD || 'password'
    };

const pool = new Pool({
  ...connectionConfig,
  ssl: process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('localhost') && !process.env.DATABASE_URL.includes('127.0.0.1')
    ? { rejectUnauthorized: false }
    : undefined,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
});

pool.on('error', (err: Error) => {
  console.error('[Database] Unexpected error on idle client', err);
});

export const getClient = async (): Promise<PoolClient> => {
  return pool.connect();
};

export const query = async (text: string, params?: Array<any>): Promise<any> => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    console.log('[Database] Query executed', { text, duration });
    return result;
  } catch (error) {
    console.error('[Database] Query error', { text, error });
    throw error;
  }
};

// Initialize database schema
export const initializeDatabase = async (): Promise<void> => {
  const client = await getClient();
  
  try {
    // Set a statement timeout of 10 seconds for migrations to prevent locking/hanging indefinitely
    await client.query('SET statement_timeout = 10000');

    // Determine path to schema.sql robustly
    let schemaPath = path.join(process.cwd(), 'database', 'schema.sql');
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.join(process.cwd(), 'backend', 'database', 'schema.sql');
    }
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.resolve(__dirname, '../../database/schema.sql');
    }
    if (!fs.existsSync(schemaPath)) {
      schemaPath = path.resolve(__dirname, 'schema.sql');
    }

    if (fs.existsSync(schemaPath)) {
      console.log(`[Database] Loading schema from ${schemaPath}`);
      const schemaSql = fs.readFileSync(schemaPath, 'utf8');
      
      // Clean single-line comments line-by-line first to prevent statements containing headers from being skipped
      const cleanSql = schemaSql
        .split('\n')
        .filter(line => !line.trim().startsWith('--'))
        .join('\n');

      const statements = cleanSql
        .split(';')
        .map(s => s.trim())
        .filter(s => s.length > 0);

      for (const statement of statements) {
        try {
          await client.query(statement);
        } catch (stmtError: any) {
          if (statement.toLowerCase().includes('create extension')) {
            console.warn('[Database] Warning: Extension creation skipped/failed:', stmtError.message);
          } else {
            throw stmtError;
          }
        }
      }
      console.log('[Database] Schema initialized successfully');
    } else {
      console.error('[Database] schema.sql file not found!');
      throw new Error('schema.sql file not found');
    }

    // Check if seeding is needed (e.g., if users table is empty)
    try {
      const userCountResult = await client.query('SELECT COUNT(*) FROM users');
      const userCount = parseInt(userCountResult.rows[0].count, 10);
      
      if (userCount === 0) {
        let seedPath = path.join(process.cwd(), 'database', 'seed.sql');
        if (!fs.existsSync(seedPath)) {
          seedPath = path.join(process.cwd(), 'backend', 'database', 'seed.sql');
        }
        if (!fs.existsSync(seedPath)) {
          seedPath = path.resolve(__dirname, '../../database/seed.sql');
        }
        if (!fs.existsSync(seedPath)) {
          seedPath = path.resolve(__dirname, 'seed.sql');
        }

        if (fs.existsSync(seedPath)) {
          console.log(`[Database] Seeding database using ${seedPath}`);
          const seedSql = fs.readFileSync(seedPath, 'utf8');
          await client.query(seedSql);
          console.log('[Database] Seed data loaded successfully');
        } else {
          console.log('[Database] seed.sql file not found, skipping seeding.');
        }
      }
    } catch (seedError) {
      console.log('[Database] Warning: Seed check or execution skipped/failed:', seedError);
    }
  } catch (error) {
    console.error('[Database] Error initializing database:', error);
    throw error;
  } finally {
    client.release();
  }
};

export const checkDbHealth = async (): Promise<boolean> => {
  try {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
      return true;
    } finally {
      client.release();
    }
  } catch (err) {
    return false;
  }
};

export default pool;

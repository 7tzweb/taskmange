import { Pool } from 'pg';
import { registerType } from 'pgvector/pg';
import prisma from '../../prisma.js';

const connectionString =
  process.env.DATABASE_URL || 'postgresql://admin:admin@localhost:5432/main?schema=public';

export const pool = new Pool({ connectionString });

let vectorReady = false;

export const ensureVectorExtension = async (): Promise<boolean> => {
  if (vectorReady) return true;
  try {
    await pool.query('CREATE EXTENSION IF NOT EXISTS vector');
    const client = await pool.connect();
    try {
      await registerType(client);
    } finally {
      client.release();
    }
    vectorReady = true;
    return true;
  } catch (err) {
    console.warn('pgvector extension not available, continuing without vector support', err);
    vectorReady = false;
    return false;
  }
};

// Try to register on boot, but don't crash the API if pgvector is missing.
ensureVectorExtension();

export { prisma };

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

const databaseUrl = process.env.DATABASE_URL || '';

// Parse SSL mode from DATABASE_URL
const isExternalConnection = databaseUrl.includes('render.com') || databaseUrl.includes('sslmode=');
const sslConfig = isExternalConnection ? { rejectUnauthorized: false } : false;

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: sslConfig,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: process.env.LOG_LEVEL === 'debug' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

module.exports = prisma;

const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const pg = require('pg');

let databaseUrl = process.env.DATABASE_URL || '';

// Strip sslmode query param — handled via explicit config below
const isExternalConnection = !databaseUrl.includes('localhost') && !databaseUrl.includes('127.0.0.1') && !databaseUrl.includes('::1');
if (isExternalConnection) {
  databaseUrl = databaseUrl.replace(/[\?&]sslmode=[^&]+/, '');
  databaseUrl = databaseUrl.replace(/[?&]$/, '');
}

const pool = new pg.Pool({
  connectionString: databaseUrl,
  ssl: isExternalConnection ? { rejectUnauthorized: false } : false,
});

const adapter = new PrismaPg(pool);

const prisma = new PrismaClient({
  adapter,
  log: process.env.LOG_LEVEL === 'debug' ? ['query', 'info', 'warn', 'error'] : ['error'],
});

module.exports = prisma;

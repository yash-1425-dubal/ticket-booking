const dotenv = require('dotenv');
dotenv.config();

const env = {
  PORT: parseInt(process.env.PORT, 10) || 4000,
  DATABASE_URL: process.env.DATABASE_URL,
  JWT_SECRET: process.env.JWT_SECRET || 'dev-jwt-secret',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:3000',
  REDIS_URL: process.env.REDIS_URL || 'redis://localhost:6379',
  SMTP_HOST: process.env.SMTP_HOST || 'smtp.gmail.com',
  SMTP_PORT: parseInt(process.env.SMTP_PORT, 10) || 587,
  SMTP_USER: process.env.SMTP_USER || '',
  SMTP_PASS: process.env.SMTP_PASS || '',
  EMAIL_FROM: process.env.EMAIL_FROM || 'noreply@ticketbooking.com',
  BULLMQ_JOB_ATTEMPTS: parseInt(process.env.BULLMQ_JOB_ATTEMPTS, 10) || 3,
  BULLMQ_BACKOFF_DELAY_MS: parseInt(process.env.BULLMQ_BACKOFF_DELAY_MS, 10) || 5000,
  SEAT_HOLD_TTL_MINUTES: parseInt(process.env.SEAT_HOLD_TTL_MINUTES, 10) || 10,
  WAITLIST_OFFER_TTL_MINUTES: parseInt(process.env.WAITLIST_OFFER_TTL_MINUTES, 10) || 15,
  LOG_LEVEL: process.env.LOG_LEVEL || 'info',
  RESEND_API_KEY: process.env.RESEND_API_KEY || '',
  RESEND_FROM_EMAIL: process.env.RESEND_FROM_EMAIL || '',
  PARSE_API_KEY: process.env.PARSE_API_KEY || '',
  PARSE_BASE_URL: process.env.PARSE_BASE_URL || '',
};

module.exports = env;

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const env = require('../../config/env');
const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');
const safeUser = require('../../utils/safeUser');

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRY = '15m';
const REFRESH_TOKEN_EXPIRY = '7d';

function generateAccessToken(user) {
  return jwt.sign(
    { userId: user.id, role: user.role },
    env.JWT_SECRET,
    { expiresIn: ACCESS_TOKEN_EXPIRY }
  );
}

function generateRefreshToken(user) {
  return jwt.sign(
    { userId: user.id, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: REFRESH_TOKEN_EXPIRY }
  );
}

async function register(input) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw ApiError.conflict('Email is already registered');

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  const verifyToken = crypto.randomBytes(32).toString('hex');
  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role || 'CUSTOMER',
      emailVerifyToken: verifyToken,
    },
  });

  // Enqueue verification email
  try {
    const { getQueue } = require('../../queues/queues');
    const emailQueue = getQueue('email');
    if (emailQueue) {
      const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${verifyToken}`;
      await emailQueue.add('email-verification', {
        userId: user.id,
        email: user.email,
        subject: 'Verify your email - Ticket Booking',
        html: `<h2>Welcome to Ticket Booking!</h2><p>Hi ${user.name || 'there'},</p><p>Please verify your email by clicking the link below:</p><p><a href="${verifyUrl}">Verify Email</a></p><p>Or copy this URL: ${verifyUrl}</p>`,
      });
    }
  } catch {}

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  return {
    user: safeUser(user),
    accessToken,
    refreshToken,
  };
}

async function login(input, context = {}) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const valid = await bcrypt.compare(input.password, user.passwordHash);
  if (!valid) throw ApiError.unauthorized('Invalid email or password');

  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken },
  });

  // Audit log and session
  try {
    await prisma.auditLog.create({
      data: {
        userId: user.id,
        action: 'USER_LOGIN',
        entityType: 'User',
        entityId: user.id,
        ipAddress: context.ip,
        userAgent: context.userAgent,
      },
    });
    await prisma.userSession.create({
      data: {
        userId: user.id,
        ipAddress: context.ip,
        userAgent: context.userAgent,
      },
    });
  } catch {}

  return {
    user: safeUser(user),
    accessToken,
    refreshToken,
  };
}

async function refresh(input) {
  let payload;
  try {
    payload = jwt.verify(input.refreshToken, env.JWT_REFRESH_SECRET);
  } catch {
    throw ApiError.unauthorized('Invalid or expired refresh token');
  }

  if (payload.type !== 'refresh') {
    throw ApiError.unauthorized('Invalid token type');
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.userId },
  });

  if (!user || user.refreshToken !== input.refreshToken) {
    throw ApiError.unauthorized('Refresh token has been revoked');
  }

  const accessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);

  await prisma.user.update({
    where: { id: user.id },
    data: { refreshToken: newRefreshToken },
  });

  return {
    user: safeUser(user),
    accessToken,
    refreshToken: newRefreshToken,
  };
}

async function forgotPassword(input) {
  const user = await prisma.user.findUnique({ where: { email: input.email } });
  if (!user) {
    return { message: 'If the email exists, a reset link has been sent' };
  }

  const resetToken = crypto.randomBytes(32).toString('hex');
  const resetTokenExpiry = new Date(Date.now() + 3600000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpiry },
  });

  // Enqueue password reset email
  try {
    const { getQueue } = require('../../queues/queues');
    const emailQueue = getQueue('email');
    if (emailQueue) {
      const resetUrl = `${env.FRONTEND_URL}/reset-password?token=${resetToken}`;
      await emailQueue.add('password-reset', {
        userId: user.id,
        email: user.email,
        subject: 'Reset your password - Ticket Booking',
        html: `<h2>Password Reset</h2><p>Hi ${user.name || 'there'},</p><p>Click the link below to reset your password. This link expires in 1 hour.</p><p><a href="${resetUrl}">Reset Password</a></p><p>Or copy this URL: ${resetUrl}</p>`,
      });
    }
  } catch {}

  return { message: 'If the email exists, a reset link has been sent' };
}

async function resetPassword(input) {
  const user = await prisma.user.findFirst({
    where: {
      resetToken: input.token,
      resetTokenExpiry: { gt: new Date() },
    },
  });

  if (!user) throw ApiError.badRequest('Invalid or expired reset token');

  const passwordHash = await bcrypt.hash(input.password, SALT_ROUNDS);
  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpiry: null,
      refreshToken: null, // Invalidate all sessions
    },
  });

  return { message: 'Password has been reset successfully' };
}

async function getCurrentUser(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  return safeUser(user);
}

async function updateProfile(userId, input) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');

  const data = {};

  if (input.name) data.name = input.name;

  if (input.email && input.email !== user.email) {
    const existing = await prisma.user.findUnique({ where: { email: input.email } });
    if (existing) throw ApiError.conflict('Email is already in use');
    data.email = input.email;
    data.isEmailVerified = false;
    // Generate new verification token
    const verifyToken = crypto.randomBytes(32).toString('hex');
    data.emailVerifyToken = verifyToken;

    // Enqueue verification email
    try {
      const { getQueue } = require('../../queues/queues');
      const emailQueue = getQueue('email');
      if (emailQueue) {
        const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${verifyToken}`;
        await emailQueue.add('email-verification', {
          userId,
          email: input.email,
          subject: 'Verify your new email - Ticket Booking',
          html: `<h2>Email Change Requested</h2><p>Hi ${user.name || 'there'},</p><p>Please verify your new email by clicking the link below:</p><p><a href="${verifyUrl}">Verify Email</a></p><p>Or copy this URL: ${verifyUrl}</p>`,
        });
      }
    } catch {}
  }

  if (input.newPassword) {
    const valid = await bcrypt.compare(input.currentPassword, user.passwordHash);
    if (!valid) throw ApiError.badRequest('Current password is incorrect');
    data.passwordHash = await bcrypt.hash(input.newPassword, SALT_ROUNDS);
  }

  const updated = await prisma.user.update({
    where: { id: userId },
    data,
  });

  return safeUser(updated);
}

async function verifyEmail(token) {
  const user = await prisma.user.findFirst({
    where: { emailVerifyToken: token },
  });

  if (!user) throw ApiError.badRequest('Invalid or expired verification token');

  await prisma.user.update({
    where: { id: user.id },
    data: { isEmailVerified: true, emailVerifyToken: null },
  });

  return { message: 'Email verified successfully' };
}

async function resendVerification(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw ApiError.notFound('User not found');
  if (user.isEmailVerified) throw ApiError.badRequest('Email is already verified');

  const verifyToken = crypto.randomBytes(32).toString('hex');
  await prisma.user.update({
    where: { id: userId },
    data: { emailVerifyToken: verifyToken },
  });

  // Enqueue verification email
  try {
    const { getQueue } = require('../../queues/queues');
    const emailQueue = getQueue('email');
    if (emailQueue) {
      const verifyUrl = `${env.FRONTEND_URL}/verify-email?token=${verifyToken}`;
      await emailQueue.add('email-verification', {
        userId,
        email: user.email,
        subject: 'Verify your email - Ticket Booking',
        html: `<h2>Email Verification</h2><p>Hi ${user.name || 'there'},</p><p>Please verify your email by clicking the link below:</p><p><a href="${verifyUrl}">Verify Email</a></p><p>Or copy this URL: ${verifyUrl}</p>`,
      });
    }
  } catch {}

  return { message: 'Verification email sent' };
}

module.exports = {
  register,
  login,
  refresh,
  forgotPassword,
  resetPassword,
  getCurrentUser,
  updateProfile,
  verifyEmail,
  resendVerification,
};

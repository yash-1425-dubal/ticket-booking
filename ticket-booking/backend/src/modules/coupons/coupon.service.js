const prisma = require('../../config/prisma');
const ApiError = require('../../utils/ApiError');

async function createCoupon(data) {
  const existing = await prisma.coupon.findUnique({ where: { code: data.code } });
  if (existing) throw ApiError.conflict('Coupon code already exists');

  return prisma.coupon.create({
    data: {
      code: data.code,
      discountType: data.discountType,
      discountValue: data.discountValue,
      maxUses: data.maxUses,
      minBookingAmount: data.minBookingAmount,
      expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
    },
  });
}

async function getAllCoupons() {
  return prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
}

async function getCouponById(id) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw ApiError.notFound('Coupon not found');
  return coupon;
}

async function updateCoupon(id, data) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw ApiError.notFound('Coupon not found');
  return prisma.coupon.update({ where: { id }, data });
}

async function deleteCoupon(id) {
  const coupon = await prisma.coupon.findUnique({ where: { id } });
  if (!coupon) throw ApiError.notFound('Coupon not found');
  await prisma.coupon.delete({ where: { id } });
}

async function validateCoupon(code, bookingAmount) {
  const coupon = await prisma.coupon.findUnique({ where: { code: code.toUpperCase() } });
  if (!coupon) throw ApiError.notFound('Invalid coupon code');
  if (!coupon.isActive) throw ApiError.badRequest('Coupon is inactive');
  if (coupon.expiresAt && coupon.expiresAt < new Date()) throw ApiError.badRequest('Coupon has expired');
  if (coupon.maxUses && coupon.usedCount >= coupon.maxUses) throw ApiError.badRequest('Coupon usage limit reached');
  if (coupon.minBookingAmount && Number(bookingAmount) < Number(coupon.minBookingAmount)) {
    throw ApiError.badRequest(`Minimum booking amount of ₹${Number(coupon.minBookingAmount).toLocaleString('en-IN')} required`);
  }

  let discountAmount;
  if (coupon.discountType === 'PERCENTAGE') {
    discountAmount = Number(bookingAmount) * (Number(coupon.discountValue) / 100);
  } else {
    discountAmount = Math.min(Number(coupon.discountValue), Number(bookingAmount));
  }

  return {
    valid: true,
    coupon: { code: coupon.code, discountType: coupon.discountType, discountValue: coupon.discountValue },
    discountAmount: Math.round(discountAmount * 100) / 100,
    finalAmount: Math.round((Number(bookingAmount) - discountAmount) * 100) / 100,
  };
}

async function incrementUsedCount(code) {
  await prisma.coupon.update({
    where: { code: code.toUpperCase() },
    data: { usedCount: { increment: 1 } },
  });
}

module.exports = { createCoupon, getAllCoupons, getCouponById, updateCoupon, deleteCoupon, validateCoupon, incrementUsedCount };

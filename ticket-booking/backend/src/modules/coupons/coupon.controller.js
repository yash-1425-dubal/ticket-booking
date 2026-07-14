const couponService = require('./coupon.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');

const create = asyncHandler(async (req, res) => {
  const coupon = await couponService.createCoupon(req.body);
  sendSuccess(res, 201, coupon, 'Coupon created');
});

const getAll = asyncHandler(async (req, res) => {
  const coupons = await couponService.getAllCoupons();
  sendSuccess(res, 200, coupons);
});

const getById = asyncHandler(async (req, res) => {
  const coupon = await couponService.getCouponById(req.params.id);
  sendSuccess(res, 200, coupon);
});

const update = asyncHandler(async (req, res) => {
  const coupon = await couponService.updateCoupon(req.params.id, req.body);
  sendSuccess(res, 200, coupon, 'Coupon updated');
});

const remove = asyncHandler(async (req, res) => {
  await couponService.deleteCoupon(req.params.id);
  sendSuccess(res, 200, null, 'Coupon deleted');
});

const validate = asyncHandler(async (req, res) => {
  const result = await couponService.validateCoupon(req.body.code, req.body.bookingAmount);
  sendSuccess(res, 200, result);
});

module.exports = { create, getAll, getById, update, remove, validate };

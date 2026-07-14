const searchService = require('./search.service');
const asyncHandler = require('../../utils/asyncHandler');
const { sendSuccess } = require('../../utils/response');

const search = asyncHandler(async (req, res) => {
  const results = await searchService.searchMovies(req.query.q, {
    city: req.query.city,
  });
  sendSuccess(res, 200, results);
});

module.exports = { search };

// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
const BASE_URL = `http://${process.env['HTTP_TEST_HOST'] || 'localhost'}:3000`
module.exports = require('request').defaults({
  baseUrl: BASE_URL,
  followRedirect: false
})

// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
const BASE_URL = `http://${process.env['HTTP_TEST_HOST'] || 'localhost'}:3000`
const request = require('request').defaults({
  baseUrl: BASE_URL,
  followRedirect: false
})

module.exports = request

module.exports.promises = {
  request: function(options) {
    return new Promise((resolve, reject) => {
      request(options, (err, response) => {
        if (err) {
          reject(err)
        } else {
          resolve(response)
        }
      })
    })
  }
}

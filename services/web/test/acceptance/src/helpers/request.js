const BASE_URL = `http://${process.env.HTTP_TEST_HOST || '127.0.0.1'}:23000`
const request = require('request').defaults({
  baseUrl: BASE_URL,
  followRedirect: false,
})

module.exports = request
module.exports.BASE_URL = BASE_URL

module.exports.promises = {
  request: function (options) {
    return new Promise((resolve, reject) => {
      request(options, (err, response) => {
        if (err) {
          reject(err)
        } else {
          resolve(response)
        }
      })
    })
  },
  BASE_URL,
}

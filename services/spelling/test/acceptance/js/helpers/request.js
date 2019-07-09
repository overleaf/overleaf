const { promisify } = require('util')

const PORT = 3005

const BASE_URL = `http://${process.env['HTTP_TEST_HOST'] ||
  'localhost'}:${PORT}`

const request = require('request').defaults({
  baseUrl: BASE_URL,
  headers: {
    'Content-Type': 'application/json'
  },
  followRedirect: false
})

module.exports = {
  PORT,
  get: promisify(request.get),
  post: promisify(request.post),
  del: promisify(request.del)
}

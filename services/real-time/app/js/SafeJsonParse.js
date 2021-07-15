const Settings = require('@overleaf/settings')
const { DataTooLargeToParseError } = require('./Errors')

module.exports = {
  parse(data, callback) {
    if (data.length > Settings.maxUpdateSize) {
      return callback(new DataTooLargeToParseError(data))
    }
    let parsed
    try {
      parsed = JSON.parse(data)
    } catch (e) {
      return callback(e)
    }
    callback(null, parsed)
  },
}

const Settings = require('settings-sharelatex')
const logger = require('logger-sharelatex')

module.exports = {
  parse(data, callback) {
    if (data.length > Settings.maxUpdateSize) {
      logger.error(
        { head: data.slice(0, 1024), length: data.length },
        'data too large to parse'
      )
      return callback(new Error('data too large to parse'))
    }
    let parsed
    try {
      parsed = JSON.parse(data)
    } catch (e) {
      return callback(e)
    }
    callback(null, parsed)
  }
}

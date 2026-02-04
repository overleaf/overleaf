import Settings from '@overleaf/settings'
import Errors from './Errors.js'

const { DataTooLargeToParseError } = Errors

export default {
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

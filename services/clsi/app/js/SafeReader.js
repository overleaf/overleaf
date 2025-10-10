/* eslint-disable
    no-unused-vars,
    n/no-deprecated-api,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let SafeReader
const fs = require('node:fs')
const logger = require('@overleaf/logger')
const { promisifyMultiResult } = require('@overleaf/promise-utils')

module.exports = SafeReader = {
  // safely read up to size bytes from a file and return result as a
  // string

  readFile(file, size, encoding, callback) {
    if (callback == null) {
      callback = function () {}
    }
    return fs.open(file, 'r', function (err, fd) {
      if (err != null && err.code === 'ENOENT') {
        return callback()
      }
      if (err != null) {
        return callback(err)
      }

      // safely return always closing the file
      const callbackWithClose = (err, ...result) =>
        fs.close(fd, function (err1) {
          if (err != null) {
            return callback(err)
          }
          if (err1 != null) {
            return callback(err1)
          }
          return callback(null, ...Array.from(result))
        })
      const buff = Buffer.alloc(size) // fills with zeroes by default
      return fs.read(
        fd,
        buff,
        0,
        buff.length,
        0,
        function (err, bytesRead, buffer) {
          if (err != null) {
            return callbackWithClose(err)
          }
          const result = buffer.toString(encoding, 0, bytesRead)
          return callbackWithClose(null, result, bytesRead)
        }
      )
    })
  },
}

module.exports.promises = {
  readFile: promisifyMultiResult(SafeReader.readFile, ['result', 'bytesRead']),
}

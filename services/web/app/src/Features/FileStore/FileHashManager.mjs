/* eslint-disable
    n/handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import crypto from 'node:crypto'
import logger from '@overleaf/logger'
import fs from 'node:fs'
import _ from 'lodash'
let FileHashManager

export default FileHashManager = {
  computeHash(filePath, callback) {
    if (callback == null) {
      callback = function () {}
    }
    callback = _.once(callback) // avoid double callbacks

    // taken from v1/history/storage/lib/blob_hash.js
    const getGitBlobHeader = byteLength => `blob ${byteLength}` + '\x00'

    const getByteLengthOfFile = cb =>
      fs.stat(filePath, function (err, stats) {
        if (err != null) {
          return cb(err)
        }
        return cb(null, stats.size)
      })

    return getByteLengthOfFile(function (err, byteLength) {
      if (err != null) {
        return callback(err)
      }

      const input = fs.createReadStream(filePath)
      input.on('error', function (err) {
        logger.warn({ filePath, err }, 'error opening file in computeHash')
        return callback(err)
      })

      const hash = crypto.createHash('sha1')
      hash.setEncoding('hex')
      hash.update(getGitBlobHeader(byteLength))
      hash.on('readable', function () {
        const result = hash.read()
        if (result != null) {
          return callback(null, result.toString('hex'))
        }
      })
      return input.pipe(hash)
    })
  },
}

/*
 * Taken from renderer/app/helpers/temp.js with minor cosmetic changes.
 * Promisify the temp package. The temp package provides a 'track' feature
 * that automatically cleans up temp files at process exit, but that is not
 * very useful. They also provide a method to trigger cleanup, but that is not
 * safe for concurrent use. So, we use a disposer to unlink the file.
 */

const BPromise = require('bluebird')
const fs = BPromise.promisifyAll(require('node:fs'))
const temp = BPromise.promisifyAll(require('temp'))

exports.open = function (affixes) {
  return temp.openAsync(affixes).disposer(function (fileInfo) {
    fs.closeAsync(fileInfo.fd)
      .then(() => {
        return fs.unlinkAsync(fileInfo.path)
      })
      .catch(function (err) {
        if (err.code !== 'ENOENT') {
          throw err
        }
      })
  })
}

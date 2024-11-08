/* eslint-disable
    no-undef,
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
import { promisify } from 'node:util'
import fs from 'node:fs'
import crypto from 'node:crypto'
import OError from '@overleaf/o-error'
import { pipeline } from 'node:stream'

export function _getBlobHashFromString(string) {
  const byteLength = Buffer.byteLength(string)
  const hash = crypto.createHash('sha1')
  hash.setEncoding('hex')
  hash.update('blob ' + byteLength + '\x00')
  hash.update(string, 'utf8')
  hash.end()
  return hash.read()
}

export function _getBlobHash(fsPath, callback) {
  return fs.stat(fsPath, function (err, stats) {
    if (err != null) {
      OError.tag(err, 'failed to stat file in _getBlobHash', { fsPath })
      return callback(err)
    }
    const byteLength = stats.size
    const hash = crypto.createHash('sha1')
    hash.setEncoding('hex')
    hash.update('blob ' + byteLength + '\x00')

    pipeline(fs.createReadStream(fsPath), hash, err => {
      if (err) {
        callback(
          OError.tag(err, 'error streaming file from disk', {
            fsPath,
            byteLength,
          })
        )
      } else {
        hash.end()
        callback(null, hash.read(), byteLength)
      }
    })
  })
}

export const promises = {
  _getBlobHash: promisify(_getBlobHash),
}

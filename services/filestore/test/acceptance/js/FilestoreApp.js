/* eslint-disable
    handle-callback-err,
    standard/no-callback-literal,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const app = require('../../../app')
require('logger-sharelatex').logger.level('info')
const logger = require('logger-sharelatex')
const Settings = require('settings-sharelatex')
const request = require('request')

const S3_TRIES = 30

module.exports = {
  running: false,
  initing: false,
  callbacks: [],
  ensureRunning(callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    if (this.running) {
      return callback()
    } else if (this.initing) {
      return this.callbacks.push(callback)
    } else {
      this.initing = true
      this.callbacks.push(callback)
      return app.listen(
        __guard__(
          Settings.internal != null ? Settings.internal.filestore : undefined,
          x => x.port
        ),
        'localhost',
        error => {
          if (error != null) {
            throw error
          }
          this.running = true
          logger.log('filestore running in dev mode')

          return (() => {
            const result = []
            for (callback of Array.from(this.callbacks)) {
              result.push(callback())
            }
            return result
          })()
        }
      )
    }
  },

  waitForS3(callback, tries) {
    if (
      !(Settings.filestore.s3 != null
        ? Settings.filestore.s3.endpoint
        : undefined)
    ) {
      return callback()
    }
    if (!tries) {
      tries = 1
    }

    return request.get(
      `${Settings.filestore.s3.endpoint}/`,
      (err, response) => {
        console.log(
          err,
          response != null ? response.statusCode : undefined,
          tries
        )
        if (
          !err &&
          [200, 404].includes(
            response != null ? response.statusCode : undefined
          )
        ) {
          return callback()
        }

        if (tries === S3_TRIES) {
          return callback('timed out waiting for S3')
        }

        return setTimeout(() => {
          return this.waitForS3(callback, tries + 1)
        }, 1000)
      }
    )
  }
}

function __guard__(value, transform) {
  return typeof value !== 'undefined' && value !== null
    ? transform(value)
    : undefined
}

/* eslint-disable
    no-return-assign,
    no-unused-vars,
    node/no-deprecated-api,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let UrlFetcher
const request = require('request').defaults({ jar: false })
const fs = require('fs')
const logger = require('@overleaf/logger')
const settings = require('@overleaf/settings')
const async = require('async')
const { URL } = require('url')
const { promisify } = require('util')

const oneMinute = 60 * 1000

module.exports = UrlFetcher = {
  pipeUrlToFileWithRetry(url, filePath, callback) {
    const doDownload = function (cb) {
      UrlFetcher.pipeUrlToFile(url, filePath, cb)
    }
    async.retry(3, doDownload, callback)
  },

  pipeUrlToFile(url, filePath, _callback) {
    if (_callback == null) {
      _callback = function () {}
    }
    const callbackOnce = function (error) {
      if (timeoutHandler != null) {
        clearTimeout(timeoutHandler)
      }
      _callback(error)
      return (_callback = function () {})
    }

    const u = new URL(url)
    if (
      settings.filestoreDomainOveride &&
      u.host !== settings.apis.clsiPerf.host
    ) {
      url = `${settings.filestoreDomainOveride}${u.pathname}${u.search}`
    }
    let timeoutHandler = setTimeout(
      function () {
        timeoutHandler = null
        logger.error({ url, filePath }, 'Timed out downloading file to cache')
        return callbackOnce(
          new Error(`Timed out downloading file to cache ${url}`)
        )
      },
      // FIXME: maybe need to close fileStream here
      3 * oneMinute
    )

    logger.log({ url, filePath }, 'started downloading url to cache')
    const urlStream = request.get({ url, timeout: oneMinute })
    urlStream.pause() // stop data flowing until we are ready

    // attach handlers before setting up pipes
    urlStream.on('error', function (error) {
      logger.error({ err: error, url, filePath }, 'error downloading url')
      return callbackOnce(
        error || new Error(`Something went wrong downloading the URL ${url}`)
      )
    })

    urlStream.on('end', () =>
      logger.log({ url, filePath }, 'finished downloading file into cache')
    )

    return urlStream.on('response', function (res) {
      if (res.statusCode >= 200 && res.statusCode < 300) {
        const atomicWrite = filePath + '~'
        const fileStream = fs.createWriteStream(atomicWrite)

        // attach handlers before setting up pipes
        fileStream.on('error', function (error) {
          logger.error(
            { err: error, url, filePath },
            'error writing file into cache'
          )
          return fs.unlink(atomicWrite, function (err) {
            if (err != null) {
              logger.err({ err, filePath }, 'error deleting file from cache')
            }
            return callbackOnce(error)
          })
        })

        fileStream.on('finish', function () {
          logger.log({ url, filePath }, 'finished writing file into cache')
          fs.rename(atomicWrite, filePath, error => {
            if (error) {
              fs.unlink(atomicWrite, () => callbackOnce(error))
            } else {
              callbackOnce()
            }
          })
        })

        fileStream.on('pipe', () =>
          logger.log({ url, filePath }, 'piping into filestream')
        )

        urlStream.pipe(fileStream)
        return urlStream.resume() // now we are ready to handle the data
      } else {
        logger.error(
          { statusCode: res.statusCode, url, filePath },
          'unexpected status code downloading url to cache'
        )
        // https://nodejs.org/api/http.html#http_class_http_clientrequest
        // If you add a 'response' event handler, then you must consume
        // the data from the response object, either by calling
        // response.read() whenever there is a 'readable' event, or by
        // adding a 'data' handler, or by calling the .resume()
        // method. Until the data is consumed, the 'end' event will not
        // fire. Also, until the data is read it will consume memory
        // that can eventually lead to a 'process out of memory' error.
        urlStream.resume() // discard the data
        return callbackOnce(
          new Error(
            `URL returned non-success status code: ${res.statusCode} ${url}`
          )
        )
      }
    })
  },
}

module.exports.promises = {
  pipeUrlToFileWithRetry: promisify(UrlFetcher.pipeUrlToFileWithRetry),
}

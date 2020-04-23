/* eslint-disable
    camelcase,
    handle-callback-err,
    no-return-assign,
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
let UrlCache
const db = require('./db')
const dbQueue = require('./DbQueue')
const UrlFetcher = require('./UrlFetcher')
const Settings = require('settings-sharelatex')
const crypto = require('crypto')
const fs = require('fs')
const logger = require('logger-sharelatex')
const async = require('async')

module.exports = UrlCache = {
  downloadUrlToFile(project_id, url, destPath, lastModified, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return UrlCache._ensureUrlIsInCache(
      project_id,
      url,
      lastModified,
      (error, pathToCachedUrl) => {
        if (error != null) {
          return callback(error)
        }
        return UrlCache._copyFile(pathToCachedUrl, destPath, function(error) {
          if (error != null) {
            return UrlCache._clearUrlDetails(project_id, url, () =>
              callback(error)
            )
          } else {
            return callback(error)
          }
        })
      }
    )
  },

  clearProject(project_id, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return UrlCache._findAllUrlsInProject(project_id, function(error, urls) {
      logger.log(
        { project_id, url_count: urls.length },
        'clearing project URLs'
      )
      if (error != null) {
        return callback(error)
      }
      const jobs = Array.from(urls || []).map(url =>
        (url => callback =>
          UrlCache._clearUrlFromCache(project_id, url, function(error) {
            if (error != null) {
              logger.error(
                { err: error, project_id, url },
                'error clearing project URL'
              )
            }
            return callback()
          }))(url)
      )
      return async.series(jobs, callback)
    })
  },

  _ensureUrlIsInCache(project_id, url, lastModified, callback) {
    if (callback == null) {
      callback = function(error, pathOnDisk) {}
    }
    if (lastModified != null) {
      // MYSQL only stores dates to an accuracy of a second but the incoming lastModified might have milliseconds.
      // So round down to seconds
      lastModified = new Date(Math.floor(lastModified.getTime() / 1000) * 1000)
    }
    return UrlCache._doesUrlNeedDownloading(
      project_id,
      url,
      lastModified,
      (error, needsDownloading) => {
        if (error != null) {
          return callback(error)
        }
        if (needsDownloading) {
          logger.log({ url, lastModified }, 'downloading URL')
          return UrlFetcher.pipeUrlToFile(
            url,
            UrlCache._cacheFilePathForUrl(project_id, url),
            error => {
              if (error != null) {
                return callback(error)
              }
              return UrlCache._updateOrCreateUrlDetails(
                project_id,
                url,
                lastModified,
                error => {
                  if (error != null) {
                    return callback(error)
                  }
                  return callback(
                    null,
                    UrlCache._cacheFilePathForUrl(project_id, url)
                  )
                }
              )
            }
          )
        } else {
          logger.log({ url, lastModified }, 'URL is up to date in cache')
          return callback(null, UrlCache._cacheFilePathForUrl(project_id, url))
        }
      }
    )
  },

  _doesUrlNeedDownloading(project_id, url, lastModified, callback) {
    if (callback == null) {
      callback = function(error, needsDownloading) {}
    }
    if (lastModified == null) {
      return callback(null, true)
    }
    return UrlCache._findUrlDetails(project_id, url, function(
      error,
      urlDetails
    ) {
      if (error != null) {
        return callback(error)
      }
      if (
        urlDetails == null ||
        urlDetails.lastModified == null ||
        urlDetails.lastModified.getTime() < lastModified.getTime()
      ) {
        return callback(null, true)
      } else {
        return callback(null, false)
      }
    })
  },

  _cacheFileNameForUrl(project_id, url) {
    return (
      project_id +
      ':' +
      crypto
        .createHash('md5')
        .update(url)
        .digest('hex')
    )
  },

  _cacheFilePathForUrl(project_id, url) {
    return `${Settings.path.clsiCacheDir}/${UrlCache._cacheFileNameForUrl(
      project_id,
      url
    )}`
  },

  _copyFile(from, to, _callback) {
    if (_callback == null) {
      _callback = function(error) {}
    }
    const callbackOnce = function(error) {
      if (error != null) {
        logger.error({ err: error, from, to }, 'error copying file from cache')
      }
      _callback(error)
      return (_callback = function() {})
    }
    const writeStream = fs.createWriteStream(to)
    const readStream = fs.createReadStream(from)
    writeStream.on('error', callbackOnce)
    readStream.on('error', callbackOnce)
    writeStream.on('close', callbackOnce)
    return writeStream.on('open', () => readStream.pipe(writeStream))
  },

  _clearUrlFromCache(project_id, url, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return UrlCache._clearUrlDetails(project_id, url, function(error) {
      if (error != null) {
        return callback(error)
      }
      return UrlCache._deleteUrlCacheFromDisk(project_id, url, function(error) {
        if (error != null) {
          return callback(error)
        }
        return callback(null)
      })
    })
  },

  _deleteUrlCacheFromDisk(project_id, url, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    return fs.unlink(UrlCache._cacheFilePathForUrl(project_id, url), function(
      error
    ) {
      if (error != null && error.code !== 'ENOENT') {
        // no error if the file isn't present
        return callback(error)
      } else {
        return callback()
      }
    })
  },

  _findUrlDetails(project_id, url, callback) {
    if (callback == null) {
      callback = function(error, urlDetails) {}
    }
    const job = cb =>
      db.UrlCache.findOne({ where: { url, project_id } })
        .then(urlDetails => cb(null, urlDetails))
        .error(cb)
    return dbQueue.queue.push(job, callback)
  },

  _updateOrCreateUrlDetails(project_id, url, lastModified, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const job = cb =>
      db.UrlCache.findOrCreate({ where: { url, project_id } })
        .spread((urlDetails, created) =>
          urlDetails
            .update({ lastModified })
            .then(() => cb())
            .error(cb)
        )
        .error(cb)
    return dbQueue.queue.push(job, callback)
  },

  _clearUrlDetails(project_id, url, callback) {
    if (callback == null) {
      callback = function(error) {}
    }
    const job = cb =>
      db.UrlCache.destroy({ where: { url, project_id } })
        .then(() => cb(null))
        .error(cb)
    return dbQueue.queue.push(job, callback)
  },

  _findAllUrlsInProject(project_id, callback) {
    if (callback == null) {
      callback = function(error, urls) {}
    }
    const job = cb =>
      db.UrlCache.findAll({ where: { project_id } })
        .then(urlEntries =>
          cb(
            null,
            urlEntries.map(entry => entry.url)
          )
        )
        .error(cb)
    return dbQueue.queue.push(job, callback)
  }
}

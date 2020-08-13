/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
require('chai').should()
const modulePath = require('path').join(__dirname, '../../../app/js/UrlCache')
const { EventEmitter } = require('events')

describe('UrlCache', function () {
  beforeEach(function () {
    this.callback = sinon.stub()
    this.url = 'www.example.com/file'
    this.project_id = 'project-id-123'
    return (this.UrlCache = SandboxedModule.require(modulePath, {
      requires: {
        './db': {},
        './UrlFetcher': (this.UrlFetcher = {}),
        'logger-sharelatex': (this.logger = { log: sinon.stub() }),
        'settings-sharelatex': (this.Settings = {
          path: { clsiCacheDir: '/cache/dir' }
        }),
        fs: (this.fs = {})
      }
    }))
  })

  describe('_doesUrlNeedDownloading', function () {
    beforeEach(function () {
      this.lastModified = new Date()
      return (this.lastModifiedRoundedToSeconds = new Date(
        Math.floor(this.lastModified.getTime() / 1000) * 1000
      ))
    })

    describe('when URL does not exist in cache', function () {
      beforeEach(function () {
        this.UrlCache._findUrlDetails = sinon.stub().callsArgWith(2, null, null)
        return this.UrlCache._doesUrlNeedDownloading(
          this.project_id,
          this.url,
          this.lastModified,
          this.callback
        )
      })

      return it('should return the callback with true', function () {
        return this.callback.calledWith(null, true).should.equal(true)
      })
    })

    return describe('when URL does exist in cache', function () {
      beforeEach(function () {
        this.urlDetails = {}
        return (this.UrlCache._findUrlDetails = sinon
          .stub()
          .callsArgWith(2, null, this.urlDetails))
      })

      describe('when the modified date is more recent than the cached modified date', function () {
        beforeEach(function () {
          this.urlDetails.lastModified = new Date(
            this.lastModified.getTime() - 1000
          )
          return this.UrlCache._doesUrlNeedDownloading(
            this.project_id,
            this.url,
            this.lastModified,
            this.callback
          )
        })

        it('should get the url details', function () {
          return this.UrlCache._findUrlDetails
            .calledWith(this.project_id, this.url)
            .should.equal(true)
        })

        return it('should return the callback with true', function () {
          return this.callback.calledWith(null, true).should.equal(true)
        })
      })

      describe('when the cached modified date is more recent than the modified date', function () {
        beforeEach(function () {
          this.urlDetails.lastModified = new Date(
            this.lastModified.getTime() + 1000
          )
          return this.UrlCache._doesUrlNeedDownloading(
            this.project_id,
            this.url,
            this.lastModified,
            this.callback
          )
        })

        return it('should return the callback with false', function () {
          return this.callback.calledWith(null, false).should.equal(true)
        })
      })

      describe('when the cached modified date is equal to the modified date', function () {
        beforeEach(function () {
          this.urlDetails.lastModified = this.lastModified
          return this.UrlCache._doesUrlNeedDownloading(
            this.project_id,
            this.url,
            this.lastModified,
            this.callback
          )
        })

        return it('should return the callback with false', function () {
          return this.callback.calledWith(null, false).should.equal(true)
        })
      })

      describe('when the provided modified date does not exist', function () {
        beforeEach(function () {
          this.lastModified = null
          return this.UrlCache._doesUrlNeedDownloading(
            this.project_id,
            this.url,
            this.lastModified,
            this.callback
          )
        })

        return it('should return the callback with true', function () {
          return this.callback.calledWith(null, true).should.equal(true)
        })
      })

      return describe('when the URL does not have a modified date', function () {
        beforeEach(function () {
          this.urlDetails.lastModified = null
          return this.UrlCache._doesUrlNeedDownloading(
            this.project_id,
            this.url,
            this.lastModified,
            this.callback
          )
        })

        return it('should return the callback with true', function () {
          return this.callback.calledWith(null, true).should.equal(true)
        })
      })
    })
  })

  describe('_ensureUrlIsInCache', function () {
    beforeEach(function () {
      this.UrlFetcher.pipeUrlToFileWithRetry = sinon.stub().callsArg(2)
      return (this.UrlCache._updateOrCreateUrlDetails = sinon
        .stub()
        .callsArg(3))
    })

    describe('when the URL needs updating', function () {
      beforeEach(function () {
        this.UrlCache._doesUrlNeedDownloading = sinon
          .stub()
          .callsArgWith(3, null, true)
        return this.UrlCache._ensureUrlIsInCache(
          this.project_id,
          this.url,
          this.lastModified,
          this.callback
        )
      })

      it('should check that the url needs downloading', function () {
        return this.UrlCache._doesUrlNeedDownloading
          .calledWith(
            this.project_id,
            this.url,
            this.lastModifiedRoundedToSeconds
          )
          .should.equal(true)
      })

      it('should download the URL to the cache file', function () {
        return this.UrlFetcher.pipeUrlToFileWithRetry
          .calledWith(
            this.url,
            this.UrlCache._cacheFilePathForUrl(this.project_id, this.url)
          )
          .should.equal(true)
      })

      it('should update the database entry', function () {
        return this.UrlCache._updateOrCreateUrlDetails
          .calledWith(
            this.project_id,
            this.url,
            this.lastModifiedRoundedToSeconds
          )
          .should.equal(true)
      })

      return it('should return the callback with the cache file path', function () {
        return this.callback
          .calledWith(
            null,
            this.UrlCache._cacheFilePathForUrl(this.project_id, this.url)
          )
          .should.equal(true)
      })
    })

    return describe('when the URL does not need updating', function () {
      beforeEach(function () {
        this.UrlCache._doesUrlNeedDownloading = sinon
          .stub()
          .callsArgWith(3, null, false)
        return this.UrlCache._ensureUrlIsInCache(
          this.project_id,
          this.url,
          this.lastModified,
          this.callback
        )
      })

      it('should not download the URL to the cache file', function () {
        return this.UrlFetcher.pipeUrlToFileWithRetry.called.should.equal(false)
      })

      return it('should return the callback with the cache file path', function () {
        return this.callback
          .calledWith(
            null,
            this.UrlCache._cacheFilePathForUrl(this.project_id, this.url)
          )
          .should.equal(true)
      })
    })
  })

  describe('downloadUrlToFile', function () {
    beforeEach(function () {
      this.cachePath = 'path/to/cached/url'
      this.destPath = 'path/to/destination'
      this.UrlCache._copyFile = sinon.stub().callsArg(2)
      this.UrlCache._ensureUrlIsInCache = sinon
        .stub()
        .callsArgWith(3, null, this.cachePath)
      return this.UrlCache.downloadUrlToFile(
        this.project_id,
        this.url,
        this.destPath,
        this.lastModified,
        this.callback
      )
    })

    it('should ensure the URL is downloaded and updated in the cache', function () {
      return this.UrlCache._ensureUrlIsInCache
        .calledWith(this.project_id, this.url, this.lastModified)
        .should.equal(true)
    })

    it('should copy the file to the new location', function () {
      return this.UrlCache._copyFile
        .calledWith(this.cachePath, this.destPath)
        .should.equal(true)
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })

  describe('_deleteUrlCacheFromDisk', function () {
    beforeEach(function () {
      this.fs.unlink = sinon.stub().callsArg(1)
      return this.UrlCache._deleteUrlCacheFromDisk(
        this.project_id,
        this.url,
        this.callback
      )
    })

    it('should delete the cache file', function () {
      return this.fs.unlink
        .calledWith(
          this.UrlCache._cacheFilePathForUrl(this.project_id, this.url)
        )
        .should.equal(true)
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })

  describe('_clearUrlFromCache', function () {
    beforeEach(function () {
      this.UrlCache._deleteUrlCacheFromDisk = sinon.stub().callsArg(2)
      this.UrlCache._clearUrlDetails = sinon.stub().callsArg(2)
      return this.UrlCache._clearUrlFromCache(
        this.project_id,
        this.url,
        this.callback
      )
    })

    it('should delete the file on disk', function () {
      return this.UrlCache._deleteUrlCacheFromDisk
        .calledWith(this.project_id, this.url)
        .should.equal(true)
    })

    it('should clear the entry in the database', function () {
      return this.UrlCache._clearUrlDetails
        .calledWith(this.project_id, this.url)
        .should.equal(true)
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })

  return describe('clearProject', function () {
    beforeEach(function () {
      this.urls = ['www.example.com/file1', 'www.example.com/file2']
      this.UrlCache._findAllUrlsInProject = sinon
        .stub()
        .callsArgWith(1, null, this.urls)
      this.UrlCache._clearUrlFromCache = sinon.stub().callsArg(2)
      return this.UrlCache.clearProject(this.project_id, this.callback)
    })

    it('should clear the cache for each url in the project', function () {
      return Array.from(this.urls).map((url) =>
        this.UrlCache._clearUrlFromCache
          .calledWith(this.project_id, url)
          .should.equal(true)
      )
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })
})

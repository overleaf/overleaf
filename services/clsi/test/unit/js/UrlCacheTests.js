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
const { expect } = require('chai')
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/UrlCache'
)

describe('UrlCache', function () {
  beforeEach(function () {
    this.callback = sinon.stub()
    this.url =
      'http://filestore/project/60b0dd39c418bc00598a0d22/file/60ae721ffb1d920027d3201f'
    this.fallbackURL = 'http://filestore/bucket/project-blobs/key/ab/cd/ef'
    this.project_id = '60b0dd39c418bc00598a0d22'
    return (this.UrlCache = SandboxedModule.require(modulePath, {
      requires: {
        './UrlFetcher': (this.UrlFetcher = {
          promises: { pipeUrlToFileWithRetry: sinon.stub().resolves() },
        }),
        '@overleaf/settings': (this.Settings = {
          path: { clsiCacheDir: '/cache/dir' },
        }),
        '@overleaf/metrics': {
          Timer: sinon.stub().returns({ done: sinon.stub() }),
        },
        fs: (this.fs = {
          promises: {
            rm: sinon.stub().resolves(),
            copyFile: sinon.stub().resolves(),
          },
        }),
      },
    }))
  })

  describe('downloadUrlToFile', function () {
    beforeEach(function () {
      this.destPath = 'path/to/destination'
    })

    it('should not download on the happy path', function (done) {
      this.UrlCache.downloadUrlToFile(
        this.project_id,
        this.url,
        this.fallbackURL,
        this.destPath,
        this.lastModified,
        error => {
          expect(error).to.not.exist
          expect(
            this.UrlFetcher.promises.pipeUrlToFileWithRetry.called
          ).to.equal(false)
          done()
        }
      )
    })

    it('should not download on the semi-happy path', function (done) {
      const codedError = new Error()
      codedError.code = 'ENOENT'
      this.fs.promises.copyFile.onCall(0).rejects(codedError)
      this.fs.promises.copyFile.onCall(1).resolves()

      this.UrlCache.downloadUrlToFile(
        this.project_id,
        this.url,
        this.fallbackURL,
        this.destPath,
        this.lastModified,
        error => {
          expect(error).to.not.exist
          expect(
            this.UrlFetcher.promises.pipeUrlToFileWithRetry.called
          ).to.equal(false)
          done()
        }
      )
    })

    it('should download on cache miss', function (done) {
      const codedError = new Error()
      codedError.code = 'ENOENT'
      this.fs.promises.copyFile.onCall(0).rejects(codedError)
      this.fs.promises.copyFile.onCall(1).rejects(codedError)
      this.fs.promises.copyFile.onCall(2).resolves()

      this.UrlCache.downloadUrlToFile(
        this.project_id,
        this.url,
        this.fallbackURL,
        this.destPath,
        this.lastModified,
        error => {
          expect(error).to.not.exist
          expect(
            this.UrlFetcher.promises.pipeUrlToFileWithRetry.called
          ).to.equal(true)
          done()
        }
      )
    })

    it('should raise non cache-miss errors', function (done) {
      const codedError = new Error()
      codedError.code = 'FOO'
      this.fs.promises.copyFile.rejects(codedError)
      this.UrlCache.downloadUrlToFile(
        this.project_id,
        this.url,
        this.fallbackURL,
        this.destPath,
        this.lastModified,
        error => {
          expect(error).to.equal(codedError)
          done()
        }
      )
    })
  })

  describe('clearProject', function () {
    beforeEach(function (done) {
      this.UrlCache.clearProject(this.project_id, done)
    })

    it('should clear the cache in bulk', function () {
      expect(
        this.fs.promises.rm.calledWith('/cache/dir/' + this.project_id, {
          force: true,
          recursive: true,
        })
      ).to.equal(true)
    })
  })
})

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
const assert = require('chai').assert
const modulePath = require('node:path').join(
  __dirname,
  '../../../app/js/ProjectPersistenceManager'
)
const tk = require('timekeeper')

describe('ProjectPersistenceManager', function () {
  beforeEach(function () {
    this.ProjectPersistenceManager = SandboxedModule.require(modulePath, {
      requires: {
        './UrlCache': (this.UrlCache = {}),
        './CompileManager': (this.CompileManager = {}),
        diskusage: (this.diskusage = { check: sinon.stub() }),
        '@overleaf/settings': (this.settings = {
          project_cache_length_ms: 1000,
          path: {
            compilesDir: '/compiles',
            outputDir: '/output',
            clsiCacheDir: '/cache',
          },
        }),
      },
    })
    this.callback = sinon.stub()
    this.project_id = 'project-id-123'
    return (this.user_id = '1234')
  })

  describe('refreshExpiryTimeout', function () {
    it('should leave expiry alone if plenty of disk', function (done) {
      this.diskusage.check.resolves({
        available: 40,
        total: 100,
      })

      this.ProjectPersistenceManager.refreshExpiryTimeout(() => {
        this.ProjectPersistenceManager.EXPIRY_TIMEOUT.should.equal(
          this.settings.project_cache_length_ms
        )
        done()
      })
    })

    it('should drop EXPIRY_TIMEOUT 10% if low disk usage', function (done) {
      this.diskusage.check.resolves({
        available: 5,
        total: 100,
      })

      this.ProjectPersistenceManager.refreshExpiryTimeout(() => {
        this.ProjectPersistenceManager.EXPIRY_TIMEOUT.should.equal(900)
        done()
      })
    })

    it('should not drop EXPIRY_TIMEOUT to below 50% of project_cache_length_ms', function (done) {
      this.diskusage.check.resolves({
        available: 5,
        total: 100,
      })
      this.ProjectPersistenceManager.EXPIRY_TIMEOUT = 500
      this.ProjectPersistenceManager.refreshExpiryTimeout(() => {
        this.ProjectPersistenceManager.EXPIRY_TIMEOUT.should.equal(500)
        done()
      })
    })

    it('should not modify EXPIRY_TIMEOUT if there is an error getting disk values', function (done) {
      this.diskusage.check.throws(new Error())
      this.ProjectPersistenceManager.refreshExpiryTimeout(() => {
        this.ProjectPersistenceManager.EXPIRY_TIMEOUT.should.equal(1000)
        done()
      })
    })
  })

  describe('clearExpiredProjects', function () {
    beforeEach(function () {
      this.project_ids = ['project-id-1', 'project-id-2']
      this.ProjectPersistenceManager._findExpiredProjectIds = sinon
        .stub()
        .callsArgWith(0, null, this.project_ids)
      this.ProjectPersistenceManager.clearProjectFromCache = sinon
        .stub()
        .callsArg(2)
      this.CompileManager.clearExpiredProjects = sinon.stub().callsArg(1)
      return this.ProjectPersistenceManager.clearExpiredProjects(this.callback)
    })

    it('should clear each expired project', function () {
      return Array.from(this.project_ids).map(projectId =>
        this.ProjectPersistenceManager.clearProjectFromCache
          .calledWith(projectId)
          .should.equal(true)
      )
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })

  return describe('clearProject', function () {
    beforeEach(function () {
      this.ProjectPersistenceManager._clearProjectFromDatabase = sinon
        .stub()
        .callsArg(1)
      this.UrlCache.clearProject = sinon.stub().callsArg(2)
      this.CompileManager.clearProject = sinon.stub().callsArg(2)
      return this.ProjectPersistenceManager.clearProject(
        this.project_id,
        this.user_id,
        this.callback
      )
    })

    it('should clear the project from the database', function () {
      return this.ProjectPersistenceManager._clearProjectFromDatabase
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should clear all the cached Urls for the project', function () {
      return this.UrlCache.clearProject
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should clear the project compile folder', function () {
      return this.CompileManager.clearProject
        .calledWith(this.project_id, this.user_id)
        .should.equal(true)
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })
})

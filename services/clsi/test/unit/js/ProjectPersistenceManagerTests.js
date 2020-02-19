/* eslint-disable
    camelcase,
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
const modulePath = require('path').join(
  __dirname,
  '../../../app/js/ProjectPersistenceManager'
)
const tk = require('timekeeper')

describe('ProjectPersistenceManager', function() {
  beforeEach(function() {
    this.ProjectPersistenceManager = SandboxedModule.require(modulePath, {
      requires: {
        './UrlCache': (this.UrlCache = {}),
        './CompileManager': (this.CompileManager = {}),
        'logger-sharelatex': (this.logger = { log: sinon.stub() }),
        './db': (this.db = {})
      }
    })
    this.callback = sinon.stub()
    this.project_id = 'project-id-123'
    return (this.user_id = '1234')
  })

  describe('clearExpiredProjects', function() {
    beforeEach(function() {
      this.project_ids = ['project-id-1', 'project-id-2']
      this.ProjectPersistenceManager._findExpiredProjectIds = sinon
        .stub()
        .callsArgWith(0, null, this.project_ids)
      this.ProjectPersistenceManager.clearProjectFromCache = sinon
        .stub()
        .callsArg(1)
      this.CompileManager.clearExpiredProjects = sinon.stub().callsArg(1)
      return this.ProjectPersistenceManager.clearExpiredProjects(this.callback)
    })

    it('should clear each expired project', function() {
      return Array.from(this.project_ids).map(project_id =>
        this.ProjectPersistenceManager.clearProjectFromCache
          .calledWith(project_id)
          .should.equal(true)
      )
    })

    return it('should call the callback', function() {
      return this.callback.called.should.equal(true)
    })
  })

  return describe('clearProject', function() {
    beforeEach(function() {
      this.ProjectPersistenceManager._clearProjectFromDatabase = sinon
        .stub()
        .callsArg(1)
      this.UrlCache.clearProject = sinon.stub().callsArg(1)
      this.CompileManager.clearProject = sinon.stub().callsArg(2)
      return this.ProjectPersistenceManager.clearProject(
        this.project_id,
        this.user_id,
        this.callback
      )
    })

    it('should clear the project from the database', function() {
      return this.ProjectPersistenceManager._clearProjectFromDatabase
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should clear all the cached Urls for the project', function() {
      return this.UrlCache.clearProject
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should clear the project compile folder', function() {
      return this.CompileManager.clearProject
        .calledWith(this.project_id, this.user_id)
        .should.equal(true)
    })

    return it('should call the callback', function() {
      return this.callback.called.should.equal(true)
    })
  })
})

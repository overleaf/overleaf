/* eslint-disable
    camelcase,
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai').should()
const modulePath =
  '../../../../app/src/Features/Project/ProjectUpdateHandler.js'
const SandboxedModule = require('sandboxed-module')

describe('ProjectUpdateHandler', function() {
  before(function() {
    this.fakeTime = new Date()
    return (this.clock = sinon.useFakeTimers(this.fakeTime.getTime()))
  })

  beforeEach(function() {
    let Project
    this.ProjectModel = Project = class Project {}
    this.ProjectModel.update = sinon.stub().callsArg(3)
    return (this.handler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../models/Project': { Project: this.ProjectModel },
        'logger-sharelatex': { log: sinon.stub() }
      }
    }))
  })

  after(function() {
    return this.clock.restore()
  })

  describe('marking a project as recently updated', function() {
    beforeEach(function() {
      this.project_id = 'project_id'
      this.lastUpdatedAt = 987654321
      return (this.lastUpdatedBy = 'fake-last-updater-id')
    })

    it('should send an update to mongo', function(done) {
      return this.handler.markAsUpdated(
        this.project_id,
        this.lastUpdatedAt,
        this.lastUpdatedBy,
        err => {
          sinon.assert.calledWith(
            this.ProjectModel.update,
            {
              _id: this.project_id,
              lastUpdated: { $lt: this.lastUpdatedAt }
            },
            {
              lastUpdated: this.lastUpdatedAt,
              lastUpdatedBy: this.lastUpdatedBy
            }
          )
          return done()
        }
      )
    })

    it('should set smart fallbacks', function(done) {
      return this.handler.markAsUpdated(this.project_id, null, null, err => {
        sinon.assert.calledWithMatch(
          this.ProjectModel.update,
          {
            _id: this.project_id,
            lastUpdated: { $lt: this.fakeTime }
          },
          {
            lastUpdated: this.fakeTime,
            lastUpdatedBy: null
          }
        )
        return done()
      })
    })
  })

  describe('markAsOpened', function() {
    it('should send an update to mongo', function(done) {
      const project_id = 'project_id'
      return this.handler.markAsOpened(project_id, err => {
        const args = this.ProjectModel.update.args[0]
        args[0]._id.should.equal(project_id)
        const date = args[1].lastOpened + ''
        const now = Date.now() + ''
        date.substring(0, 5).should.equal(now.substring(0, 5))
        return done()
      })
    })
  })

  describe('markAsInactive', function() {
    it('should send an update to mongo', function(done) {
      const project_id = 'project_id'
      return this.handler.markAsInactive(project_id, err => {
        const args = this.ProjectModel.update.args[0]
        args[0]._id.should.equal(project_id)
        args[1].active.should.equal(false)
        return done()
      })
    })
  })

  describe('markAsActive', function() {
    it('should send an update to mongo', function(done) {
      const project_id = 'project_id'
      return this.handler.markAsActive(project_id, err => {
        const args = this.ProjectModel.update.args[0]
        args[0]._id.should.equal(project_id)
        args[1].active.should.equal(true)
        return done()
      })
    })
  })
})

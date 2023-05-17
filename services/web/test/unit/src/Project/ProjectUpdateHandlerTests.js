/* eslint-disable
    n/handle-callback-err,
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
const modulePath =
  '../../../../app/src/Features/Project/ProjectUpdateHandler.js'
const SandboxedModule = require('sandboxed-module')

describe('ProjectUpdateHandler', function () {
  beforeEach(function () {
    this.fakeTime = new Date()
    this.clock = sinon.useFakeTimers(this.fakeTime.getTime())
  })

  afterEach(function () {
    this.clock.restore()
  })

  beforeEach(function () {
    let Project
    this.ProjectModel = Project = class Project {}
    this.ProjectModel.updateOne = sinon.stub().callsArg(3)
    return (this.handler = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/Project': { Project: this.ProjectModel },
      },
    }))
  })

  describe('marking a project as recently updated', function () {
    beforeEach(function () {
      this.project_id = 'project_id'
      this.lastUpdatedAt = 987654321
      return (this.lastUpdatedBy = 'fake-last-updater-id')
    })

    it('should send an update to mongo', function (done) {
      return this.handler.markAsUpdated(
        this.project_id,
        this.lastUpdatedAt,
        this.lastUpdatedBy,
        err => {
          sinon.assert.calledWith(
            this.ProjectModel.updateOne,
            {
              _id: this.project_id,
              lastUpdated: { $lt: this.lastUpdatedAt },
            },
            {
              lastUpdated: this.lastUpdatedAt,
              lastUpdatedBy: this.lastUpdatedBy,
            }
          )
          return done()
        }
      )
    })

    it('should set smart fallbacks', function (done) {
      return this.handler.markAsUpdated(this.project_id, null, null, err => {
        sinon.assert.calledWithMatch(
          this.ProjectModel.updateOne,
          {
            _id: this.project_id,
            lastUpdated: { $lt: this.fakeTime },
          },
          {
            lastUpdated: this.fakeTime,
            lastUpdatedBy: null,
          }
        )
        return done()
      })
    })
  })

  describe('markAsOpened', function () {
    it('should send an update to mongo', function (done) {
      const projectId = 'project_id'
      return this.handler.markAsOpened(projectId, err => {
        const args = this.ProjectModel.updateOne.args[0]
        args[0]._id.should.equal(projectId)
        const date = args[1].lastOpened + ''
        const now = Date.now() + ''
        date.substring(0, 5).should.equal(now.substring(0, 5))
        return done()
      })
    })
  })

  describe('markAsInactive', function () {
    it('should send an update to mongo', function (done) {
      const projectId = 'project_id'
      return this.handler.markAsInactive(projectId, err => {
        const args = this.ProjectModel.updateOne.args[0]
        args[0]._id.should.equal(projectId)
        args[1].active.should.equal(false)
        return done()
      })
    })
  })

  describe('markAsActive', function () {
    it('should send an update to mongo', function (done) {
      const projectId = 'project_id'
      return this.handler.markAsActive(projectId, err => {
        const args = this.ProjectModel.updateOne.args[0]
        args[0]._id.should.equal(projectId)
        args[1].active.should.equal(true)
        return done()
      })
    })
  })
})

/* eslint-disable
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const modulePath = '../../../../app/js/ProjectManager.js'
const SandboxedModule = require('sandboxed-module')
const Errors = require('../../../../app/js/Errors.js')

describe('ProjectManager - getProjectDocsAndFlushIfOld', function () {
  beforeEach(function () {
    let Timer
    this.ProjectManager = SandboxedModule.require(modulePath, {
      requires: {
        './RedisManager': (this.RedisManager = {}),
        './ProjectHistoryRedisManager': (this.ProjectHistoryRedisManager = {}),
        './DocumentManager': (this.DocumentManager = {}),
        './HistoryManager': (this.HistoryManager = {}),
        './Metrics': (this.Metrics = {
          Timer: (Timer = (function () {
            Timer = class Timer {
              static initClass() {
                this.prototype.done = sinon.stub()
              }
            }
            Timer.initClass()
            return Timer
          })()),
        }),
        './Errors': Errors,
      },
    })
    this.project_id = 'project-id-123'
    this.callback = sinon.stub()
    return (this.doc_versions = [111, 222, 333])
  })

  describe('successfully', function () {
    beforeEach(function (done) {
      this.doc_ids = ['doc-id-1', 'doc-id-2', 'doc-id-3']
      this.doc_lines = [
        ['aaa', 'aaa'],
        ['bbb', 'bbb'],
        ['ccc', 'ccc'],
      ]
      this.docs = [
        {
          _id: this.doc_ids[0],
          lines: this.doc_lines[0],
          v: this.doc_versions[0],
        },
        {
          _id: this.doc_ids[1],
          lines: this.doc_lines[1],
          v: this.doc_versions[1],
        },
        {
          _id: this.doc_ids[2],
          lines: this.doc_lines[2],
          v: this.doc_versions[2],
        },
      ]
      this.RedisManager.checkOrSetProjectState = sinon
        .stub()
        .callsArgWith(2, null)
      this.RedisManager.getDocIdsInProject = sinon
        .stub()
        .callsArgWith(1, null, this.doc_ids)
      this.DocumentManager.getDocAndFlushIfOldWithLock = sinon.stub()
      this.DocumentManager.getDocAndFlushIfOldWithLock
        .withArgs(this.project_id, this.doc_ids[0])
        .callsArgWith(2, null, this.doc_lines[0], this.doc_versions[0])
      this.DocumentManager.getDocAndFlushIfOldWithLock
        .withArgs(this.project_id, this.doc_ids[1])
        .callsArgWith(2, null, this.doc_lines[1], this.doc_versions[1])
      this.DocumentManager.getDocAndFlushIfOldWithLock
        .withArgs(this.project_id, this.doc_ids[2])
        .callsArgWith(2, null, this.doc_lines[2], this.doc_versions[2])
      return this.ProjectManager.getProjectDocsAndFlushIfOld(
        this.project_id,
        this.projectStateHash,
        this.excludeVersions,
        (error, docs) => {
          this.callback(error, docs)
          return done()
        }
      )
    })

    it('should check the project state', function () {
      return this.RedisManager.checkOrSetProjectState
        .calledWith(this.project_id, this.projectStateHash)
        .should.equal(true)
    })

    it('should get the doc ids in the project', function () {
      return this.RedisManager.getDocIdsInProject
        .calledWith(this.project_id)
        .should.equal(true)
    })

    it('should call the callback without error', function () {
      return this.callback.calledWith(null, this.docs).should.equal(true)
    })

    return it('should time the execution', function () {
      return this.Metrics.Timer.prototype.done.called.should.equal(true)
    })
  })

  describe('when the state does not match', function () {
    beforeEach(function (done) {
      this.doc_ids = ['doc-id-1', 'doc-id-2', 'doc-id-3']
      this.RedisManager.checkOrSetProjectState = sinon
        .stub()
        .callsArgWith(2, null, true)
      return this.ProjectManager.getProjectDocsAndFlushIfOld(
        this.project_id,
        this.projectStateHash,
        this.excludeVersions,
        (error, docs) => {
          this.callback(error, docs)
          return done()
        }
      )
    })

    it('should check the project state', function () {
      return this.RedisManager.checkOrSetProjectState
        .calledWith(this.project_id, this.projectStateHash)
        .should.equal(true)
    })

    it('should call the callback with an error', function () {
      return this.callback
        .calledWith(sinon.match.instanceOf(Errors.ProjectStateChangedError))
        .should.equal(true)
    })

    return it('should time the execution', function () {
      return this.Metrics.Timer.prototype.done.called.should.equal(true)
    })
  })

  describe('when a doc errors', function () {
    beforeEach(function (done) {
      this.doc_ids = ['doc-id-1', 'doc-id-2', 'doc-id-3']
      this.RedisManager.checkOrSetProjectState = sinon
        .stub()
        .callsArgWith(2, null)
      this.RedisManager.getDocIdsInProject = sinon
        .stub()
        .callsArgWith(1, null, this.doc_ids)
      this.DocumentManager.getDocAndFlushIfOldWithLock = sinon.stub()
      this.DocumentManager.getDocAndFlushIfOldWithLock
        .withArgs(this.project_id, 'doc-id-1')
        .callsArgWith(2, null, ['test doc content'], this.doc_versions[1])
      this.DocumentManager.getDocAndFlushIfOldWithLock
        .withArgs(this.project_id, 'doc-id-2')
        .callsArgWith(2, (this.error = new Error('oops'))) // trigger an error
      return this.ProjectManager.getProjectDocsAndFlushIfOld(
        this.project_id,
        this.projectStateHash,
        this.excludeVersions,
        (error, docs) => {
          this.callback(error)
          return done()
        }
      )
    })

    it('should record the error', function () {
      return this.logger.error
        .calledWith(
          { err: this.error, projectId: this.project_id, docId: 'doc-id-2' },
          'error getting project doc lines in getProjectDocsAndFlushIfOld'
        )
        .should.equal(true)
    })

    it('should call the callback with an error', function () {
      return this.callback
        .calledWith(sinon.match.instanceOf(Error))
        .should.equal(true)
    })

    return it('should time the execution', function () {
      return this.Metrics.Timer.prototype.done.called.should.equal(true)
    })
  })

  return describe('clearing the project state with clearProjectState', function () {
    beforeEach(function (done) {
      this.RedisManager.clearProjectState = sinon.stub().callsArg(1)
      return this.ProjectManager.clearProjectState(this.project_id, error => {
        this.callback(error)
        return done()
      })
    })

    it('should clear the project state', function () {
      return this.RedisManager.clearProjectState
        .calledWith(this.project_id)
        .should.equal(true)
    })

    return it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })
  })
})

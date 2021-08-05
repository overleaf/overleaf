/* eslint-disable
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
const { expect } = require('chai')
const modulePath = '../../../../app/js/HttpController.js'
const SandboxedModule = require('sandboxed-module')

describe('HttpController', function () {
  beforeEach(function () {
    this.HttpController = SandboxedModule.require(modulePath, {
      singleOnly: true,
      requires: {
        './UpdatesManager': (this.UpdatesManager = {}),
        './DiffManager': (this.DiffManager = {}),
        './RestoreManager': (this.RestoreManager = {}),
        './PackManager': (this.PackManager = {}),
        './DocArchiveManager': (this.DocArchiveManager = {}),
        './HealthChecker': (this.HealthChecker = {}),
      },
    })
    this.doc_id = 'doc-id-123'
    this.project_id = 'project-id-123'
    this.next = sinon.stub()
    this.user_id = 'mock-user-123'
    return (this.now = Date.now())
  })

  describe('flushDoc', function () {
    beforeEach(function () {
      this.req = {
        params: {
          doc_id: this.doc_id,
          project_id: this.project_id,
        },
      }
      this.res = { sendStatus: sinon.stub() }
      this.UpdatesManager.processUncompressedUpdatesWithLock = sinon
        .stub()
        .callsArg(2)
      return this.HttpController.flushDoc(this.req, this.res, this.next)
    })

    it('should process the updates', function () {
      return this.UpdatesManager.processUncompressedUpdatesWithLock
        .calledWith(this.project_id, this.doc_id)
        .should.equal(true)
    })

    return it('should return a success code', function () {
      return this.res.sendStatus.calledWith(204).should.equal(true)
    })
  })

  describe('flushProject', function () {
    beforeEach(function () {
      this.req = {
        params: {
          project_id: this.project_id,
        },
      }
      this.res = { sendStatus: sinon.stub() }
      this.UpdatesManager.processUncompressedUpdatesForProject = sinon
        .stub()
        .callsArg(1)
      return this.HttpController.flushProject(this.req, this.res, this.next)
    })

    it('should process the updates', function () {
      return this.UpdatesManager.processUncompressedUpdatesForProject
        .calledWith(this.project_id)
        .should.equal(true)
    })

    return it('should return a success code', function () {
      return this.res.sendStatus.calledWith(204).should.equal(true)
    })
  })

  describe('getDiff', function () {
    beforeEach(function () {
      this.from = 42
      this.to = 45
      this.req = {
        params: {
          doc_id: this.doc_id,
          project_id: this.project_id,
        },
        query: {
          from: this.from.toString(),
          to: this.to.toString(),
        },
      }
      this.res = { json: sinon.stub() }
      this.diff = [{ u: 'mock-diff' }]
      this.DiffManager.getDiff = sinon.stub().callsArgWith(4, null, this.diff)
      return this.HttpController.getDiff(this.req, this.res, this.next)
    })

    it('should get the diff', function () {
      return this.DiffManager.getDiff
        .calledWith(
          this.project_id,
          this.doc_id,
          parseInt(this.from, 10),
          parseInt(this.to, 10)
        )
        .should.equal(true)
    })

    return it('should return the diff', function () {
      return this.res.json.calledWith({ diff: this.diff }).should.equal(true)
    })
  })

  describe('getUpdates', function () {
    beforeEach(function () {
      this.before = Date.now()
      this.nextBeforeTimestamp = this.before - 100
      this.min_count = 10
      this.req = {
        params: {
          project_id: this.project_id,
        },
        query: {
          before: this.before.toString(),
          min_count: this.min_count.toString(),
        },
      }
      this.res = { json: sinon.stub() }
      this.updates = ['mock-summarized-updates']
      this.UpdatesManager.getSummarizedProjectUpdates = sinon
        .stub()
        .callsArgWith(2, null, this.updates, this.nextBeforeTimestamp)
      return this.HttpController.getUpdates(this.req, this.res, this.next)
    })

    it('should get the updates', function () {
      return this.UpdatesManager.getSummarizedProjectUpdates
        .calledWith(this.project_id, {
          before: this.before,
          min_count: this.min_count,
        })
        .should.equal(true)
    })

    return it('should return the formatted updates', function () {
      return this.res.json
        .calledWith({
          updates: this.updates,
          nextBeforeTimestamp: this.nextBeforeTimestamp,
        })
        .should.equal(true)
    })
  })

  return describe('RestoreManager', function () {
    beforeEach(function () {
      this.version = '42'
      this.req = {
        params: {
          doc_id: this.doc_id,
          project_id: this.project_id,
          version: this.version,
        },
        headers: {
          'x-user-id': this.user_id,
        },
      }
      this.res = { sendStatus: sinon.stub() }

      this.RestoreManager.restoreToBeforeVersion = sinon.stub().callsArg(4)
      return this.HttpController.restore(this.req, this.res, this.next)
    })

    it('should restore the document', function () {
      return this.RestoreManager.restoreToBeforeVersion
        .calledWith(
          this.project_id,
          this.doc_id,
          parseInt(this.version, 10),
          this.user_id
        )
        .should.equal(true)
    })

    return it('should return a success code', function () {
      return this.res.sendStatus.calledWith(204).should.equal(true)
    })
  })
})

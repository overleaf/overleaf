/* eslint-disable
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
const SandboxedModule = require('sandboxed-module')
const should = require('chai').should()
const sinon = require('sinon')
const { assert } = require('chai')
const modulePath =
  '../../../../app/src/Features/References/ReferencesController'
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')

describe('ReferencesController', function() {
  beforeEach(function() {
    this.projectId = '2222'
    this.controller = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'logger-sharelatex': {
          log() {},
          err() {}
        },
        'settings-sharelatex': (this.settings = {
          apis: { web: { url: 'http://some.url' } }
        }),
        './ReferencesHandler': (this.ReferencesHandler = {
          index: sinon.stub(),
          indexAll: sinon.stub()
        }),
        '../Editor/EditorRealTimeController': (this.EditorRealTimeController = {
          emitToRoom: sinon.stub()
        })
      }
    })
    this.req = new MockRequest()
    this.req.params.Project_id = this.projectId
    this.req.body = {
      docIds: (this.docIds = ['aaa', 'bbb']),
      shouldBroadcast: false
    }
    this.res = new MockResponse()
    this.res.json = sinon.stub()
    this.res.send = sinon.stub()
    this.res.sendStatus = sinon.stub()
    return (this.fakeResponseData = {
      projectId: this.projectId,
      keys: ['one', 'two', 'three']
    })
  })

  describe('indexAll', function() {
    beforeEach(function() {
      this.req.body = { shouldBroadcast: false }
      this.ReferencesHandler.indexAll.callsArgWith(
        1,
        null,
        this.fakeResponseData
      )
      return (this.call = callback => {
        this.controller.indexAll(this.req, this.res)
        return callback()
      })
    })

    it('should not produce an error', function(done) {
      return this.call(() => {
        this.res.sendStatus.callCount.should.equal(0)
        this.res.sendStatus.calledWith(500).should.equal(false)
        this.res.sendStatus.calledWith(400).should.equal(false)
        return done()
      })
    })

    it('should return data', function(done) {
      return this.call(() => {
        this.res.json.callCount.should.equal(1)
        this.res.json.calledWith(this.fakeResponseData).should.equal(true)
        return done()
      })
    })

    it('should call ReferencesHandler.indexAll', function(done) {
      return this.call(() => {
        this.ReferencesHandler.indexAll.callCount.should.equal(1)
        this.ReferencesHandler.indexAll
          .calledWith(this.projectId)
          .should.equal(true)
        return done()
      })
    })

    describe('when shouldBroadcast is true', function() {
      beforeEach(function() {
        this.ReferencesHandler.index.callsArgWith(
          2,
          null,
          this.fakeResponseData
        )
        return (this.req.body.shouldBroadcast = true)
      })

      it('should call EditorRealTimeController.emitToRoom', function(done) {
        return this.call(() => {
          this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
          return done()
        })
      })

      it('should not produce an error', function(done) {
        return this.call(() => {
          this.res.sendStatus.callCount.should.equal(0)
          this.res.sendStatus.calledWith(500).should.equal(false)
          this.res.sendStatus.calledWith(400).should.equal(false)
          return done()
        })
      })

      it('should still return data', function(done) {
        return this.call(() => {
          this.res.json.callCount.should.equal(1)
          this.res.json.calledWith(this.fakeResponseData).should.equal(true)
          return done()
        })
      })
    })

    describe('when shouldBroadcast is false', function() {
      beforeEach(function() {
        this.ReferencesHandler.index.callsArgWith(
          2,
          null,
          this.fakeResponseData
        )
        return (this.req.body.shouldBroadcast = false)
      })

      it('should not call EditorRealTimeController.emitToRoom', function(done) {
        return this.call(() => {
          this.EditorRealTimeController.emitToRoom.callCount.should.equal(0)
          return done()
        })
      })

      it('should not produce an error', function(done) {
        return this.call(() => {
          this.res.sendStatus.callCount.should.equal(0)
          this.res.sendStatus.calledWith(500).should.equal(false)
          this.res.sendStatus.calledWith(400).should.equal(false)
          return done()
        })
      })

      it('should still return data', function(done) {
        return this.call(() => {
          this.res.json.callCount.should.equal(1)
          this.res.json.calledWith(this.fakeResponseData).should.equal(true)
          return done()
        })
      })
    })
  })

  describe('there is no data', function() {
    beforeEach(function() {
      this.ReferencesHandler.indexAll.callsArgWith(1)
      return (this.call = callback => {
        this.controller.indexAll(this.req, this.res)
        return callback()
      })
    })

    it('should not call EditorRealTimeController.emitToRoom', function(done) {
      return this.call(() => {
        this.EditorRealTimeController.emitToRoom.callCount.should.equal(0)
        return done()
      })
    })

    it('should not produce an error', function(done) {
      return this.call(() => {
        this.res.sendStatus.callCount.should.equal(0)
        this.res.sendStatus.calledWith(500).should.equal(false)
        this.res.sendStatus.calledWith(400).should.equal(false)
        return done()
      })
    })

    it('should send a response with an empty keys list', function(done) {
      return this.call(() => {
        this.res.json.called.should.equal(true)
        this.res.json
          .calledWith({ projectId: this.projectId, keys: [] })
          .should.equal(true)
        return done()
      })
    })
  })

  describe('index', function() {
    beforeEach(function() {
      return (this.call = callback => {
        this.controller.index(this.req, this.res)
        return callback()
      })
    })

    describe('with docIds as an array and shouldBroadcast as false', function() {
      beforeEach(function() {
        return this.ReferencesHandler.index.callsArgWith(
          2,
          null,
          this.fakeResponseData
        )
      })

      it('should call ReferencesHandler.index', function(done) {
        return this.call(() => {
          this.ReferencesHandler.index.callCount.should.equal(1)
          this.ReferencesHandler.index
            .calledWith(this.projectId, this.docIds)
            .should.equal(true)
          return done()
        })
      })

      it('should return data', function(done) {
        return this.call(() => {
          this.res.json.callCount.should.equal(1)
          this.res.json.calledWith(this.fakeResponseData).should.equal(true)
          return done()
        })
      })

      it('should not produce an error', function(done) {
        return this.call(() => {
          this.res.sendStatus.callCount.should.equal(0)
          this.res.sendStatus.calledWith(500).should.equal(false)
          this.res.sendStatus.calledWith(400).should.equal(false)
          return done()
        })
      })

      it('should not call EditorRealTimController.emitToRoom', function(done) {
        return this.call(() => {
          this.EditorRealTimeController.emitToRoom.callCount.should.equal(0)
          return done()
        })
      })

      describe('when ReferencesHandler.index produces an error', function() {
        beforeEach(function() {
          return this.ReferencesHandler.index.callsArgWith(
            2,
            new Error('woops'),
            null
          )
        })

        it('should produce an error response', function(done) {
          return this.call(() => {
            this.res.sendStatus.callCount.should.equal(1)
            this.res.sendStatus.calledWith(500).should.equal(true)
            return done()
          })
        })
      })
    })

    describe('when shouldBroadcast is true', function() {
      beforeEach(function() {
        this.ReferencesHandler.index.callsArgWith(
          2,
          null,
          this.fakeResponseData
        )
        return (this.req.body.shouldBroadcast = true)
      })

      it('should call EditorRealTimeController.emitToRoom', function(done) {
        return this.call(() => {
          this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
          return done()
        })
      })

      it('should not produce an error', function(done) {
        return this.call(() => {
          this.res.sendStatus.callCount.should.equal(0)
          this.res.sendStatus.calledWith(500).should.equal(false)
          this.res.sendStatus.calledWith(400).should.equal(false)
          return done()
        })
      })

      it('should still return data', function(done) {
        return this.call(() => {
          this.res.json.callCount.should.equal(1)
          this.res.json.calledWith(this.fakeResponseData).should.equal(true)
          return done()
        })
      })
    })

    describe('with missing docIds', function() {
      beforeEach(function() {
        return delete this.req.body.docIds
      })

      it('should produce an error response', function(done) {
        return this.call(() => {
          this.res.sendStatus.callCount.should.equal(1)
          this.res.sendStatus.calledWith(400).should.equal(true)
          return done()
        })
      })

      it('should not call ReferencesHandler.index', function(done) {
        return this.call(() => {
          this.ReferencesHandler.index.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('with invalid docIds', function() {
      beforeEach(function() {
        return (this.req.body.docIds = 42)
      })

      it('should produce an error response', function(done) {
        return this.call(() => {
          this.res.sendStatus.callCount.should.equal(1)
          this.res.sendStatus.calledWith(400).should.equal(true)
          return done()
        })
      })

      it('should not call ReferencesHandler.index', function(done) {
        return this.call(() => {
          this.ReferencesHandler.index.callCount.should.equal(0)
          return done()
        })
      })
    })
  })
})

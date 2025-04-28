import esmock from 'esmock'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.js'
import MockResponse from '../helpers/MockResponse.js'
const modulePath =
  '../../../../app/src/Features/References/ReferencesController'

describe('ReferencesController', function () {
  beforeEach(async function () {
    this.projectId = '2222'
    this.controller = await esmock.strict(modulePath, {
      '@overleaf/settings': (this.settings = {
        apis: { web: { url: 'http://some.url' } },
      }),
      '../../../../app/src/Features/References/ReferencesHandler':
        (this.ReferencesHandler = {
          index: sinon.stub(),
          indexAll: sinon.stub(),
        }),
      '../../../../app/src/Features/Editor/EditorRealTimeController':
        (this.EditorRealTimeController = {
          emitToRoom: sinon.stub(),
        }),
    })
    this.req = new MockRequest()
    this.req.params.Project_id = this.projectId
    this.req.body = {
      docIds: (this.docIds = ['aaa', 'bbb']),
      shouldBroadcast: false,
    }
    this.res = new MockResponse()
    this.res.json = sinon.stub()
    this.res.sendStatus = sinon.stub()
    this.next = sinon.stub()
    this.fakeResponseData = {
      projectId: this.projectId,
      keys: ['one', 'two', 'three'],
    }
  })

  describe('indexAll', function () {
    beforeEach(function () {
      this.req.body = { shouldBroadcast: false }
      this.ReferencesHandler.indexAll.callsArgWith(
        1,
        null,
        this.fakeResponseData
      )
      this.call = callback => {
        this.controller.indexAll(this.req, this.res, this.next)
        return callback()
      }
    })

    it('should not produce an error', function (done) {
      this.call(() => {
        this.res.sendStatus.callCount.should.equal(0)
        this.res.sendStatus.calledWith(500).should.equal(false)
        this.res.sendStatus.calledWith(400).should.equal(false)
        done()
      })
    })

    it('should return data', function (done) {
      this.call(() => {
        this.res.json.callCount.should.equal(1)
        this.res.json.calledWith(this.fakeResponseData).should.equal(true)
        done()
      })
    })

    it('should call ReferencesHandler.indexAll', function (done) {
      this.call(() => {
        this.ReferencesHandler.indexAll.callCount.should.equal(1)
        this.ReferencesHandler.indexAll
          .calledWith(this.projectId)
          .should.equal(true)
        done()
      })
    })

    describe('when shouldBroadcast is true', function () {
      beforeEach(function () {
        this.ReferencesHandler.index.callsArgWith(
          2,
          null,
          this.fakeResponseData
        )
        this.req.body.shouldBroadcast = true
      })

      it('should call EditorRealTimeController.emitToRoom', function (done) {
        this.call(() => {
          this.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
          done()
        })
      })

      it('should not produce an error', function (done) {
        this.call(() => {
          this.res.sendStatus.callCount.should.equal(0)
          this.res.sendStatus.calledWith(500).should.equal(false)
          this.res.sendStatus.calledWith(400).should.equal(false)
          done()
        })
      })

      it('should still return data', function (done) {
        this.call(() => {
          this.res.json.callCount.should.equal(1)
          this.res.json.calledWith(this.fakeResponseData).should.equal(true)
          done()
        })
      })
    })

    describe('when shouldBroadcast is false', function () {
      beforeEach(function () {
        this.ReferencesHandler.index.callsArgWith(
          2,
          null,
          this.fakeResponseData
        )
        this.req.body.shouldBroadcast = false
      })

      it('should not call EditorRealTimeController.emitToRoom', function (done) {
        this.call(() => {
          this.EditorRealTimeController.emitToRoom.callCount.should.equal(0)
          done()
        })
      })

      it('should not produce an error', function (done) {
        this.call(() => {
          this.res.sendStatus.callCount.should.equal(0)
          this.res.sendStatus.calledWith(500).should.equal(false)
          this.res.sendStatus.calledWith(400).should.equal(false)
          done()
        })
      })

      it('should still return data', function (done) {
        this.call(() => {
          this.res.json.callCount.should.equal(1)
          this.res.json.calledWith(this.fakeResponseData).should.equal(true)
          done()
        })
      })
    })
  })

  describe('there is no data', function () {
    beforeEach(function () {
      this.ReferencesHandler.indexAll.callsArgWith(1)
      this.call = callback => {
        this.controller.indexAll(this.req, this.res, this.next)
        callback()
      }
    })

    it('should not call EditorRealTimeController.emitToRoom', function (done) {
      this.call(() => {
        this.EditorRealTimeController.emitToRoom.callCount.should.equal(0)
        done()
      })
    })

    it('should not produce an error', function (done) {
      this.call(() => {
        this.res.sendStatus.callCount.should.equal(0)
        this.res.sendStatus.calledWith(500).should.equal(false)
        this.res.sendStatus.calledWith(400).should.equal(false)
        done()
      })
    })

    it('should send a response with an empty keys list', function (done) {
      this.call(() => {
        this.res.json.called.should.equal(true)
        this.res.json
          .calledWith({ projectId: this.projectId, keys: [] })
          .should.equal(true)
        done()
      })
    })
  })
})

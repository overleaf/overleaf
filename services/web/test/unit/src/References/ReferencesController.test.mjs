import { vi } from 'vitest'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.js'
import MockResponse from '../helpers/MockResponse.js'
const modulePath =
  '../../../../app/src/Features/References/ReferencesController'

describe('ReferencesController', function () {
  beforeEach(async function (ctx) {
    ctx.projectId = '2222'

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {
        apis: { web: { url: 'http://some.url' } },
      }),
    }))

    vi.doMock(
      '../../../../app/src/Features/References/ReferencesHandler',
      () => ({
        default: (ctx.ReferencesHandler = {
          index: sinon.stub(),
          indexAll: sinon.stub(),
        }),
      })
    )

    vi.doMock(
      '../../../../app/src/Features/Editor/EditorRealTimeController',
      () => ({
        default: (ctx.EditorRealTimeController = {
          emitToRoom: sinon.stub(),
        }),
      })
    )

    ctx.controller = (await import(modulePath)).default
    ctx.req = new MockRequest()
    ctx.req.params.Project_id = ctx.projectId
    ctx.req.body = {
      docIds: (ctx.docIds = ['aaa', 'bbb']),
      shouldBroadcast: false,
    }
    ctx.res = new MockResponse()
    ctx.res.json = sinon.stub()
    ctx.res.sendStatus = sinon.stub()
    ctx.next = sinon.stub()
    ctx.fakeResponseData = {
      projectId: ctx.projectId,
      keys: ['one', 'two', 'three'],
    }
  })

  describe('indexAll', function () {
    beforeEach(function (ctx) {
      ctx.req.body = { shouldBroadcast: false }
      ctx.ReferencesHandler.indexAll.callsArgWith(1, null, ctx.fakeResponseData)
      ctx.call = callback => {
        ctx.controller.indexAll(ctx.req, ctx.res, ctx.next)
        return callback()
      }
    })

    it('should not produce an error', function (ctx) {
      return new Promise(resolve => {
        ctx.call(() => {
          ctx.res.sendStatus.callCount.should.equal(0)
          ctx.res.sendStatus.calledWith(500).should.equal(false)
          ctx.res.sendStatus.calledWith(400).should.equal(false)
          resolve()
        })
      })
    })

    it('should return data', function (ctx) {
      return new Promise(resolve => {
        ctx.call(() => {
          ctx.res.json.callCount.should.equal(1)
          ctx.res.json.calledWith(ctx.fakeResponseData).should.equal(true)
          resolve()
        })
      })
    })

    it('should call ReferencesHandler.indexAll', function (ctx) {
      return new Promise(resolve => {
        ctx.call(() => {
          ctx.ReferencesHandler.indexAll.callCount.should.equal(1)
          ctx.ReferencesHandler.indexAll
            .calledWith(ctx.projectId)
            .should.equal(true)
          resolve()
        })
      })
    })

    describe('when shouldBroadcast is true', function () {
      beforeEach(function (ctx) {
        ctx.ReferencesHandler.index.callsArgWith(2, null, ctx.fakeResponseData)
        ctx.req.body.shouldBroadcast = true
      })

      it('should call EditorRealTimeController.emitToRoom', function (ctx) {
        return new Promise(resolve => {
          ctx.call(() => {
            ctx.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
            resolve()
          })
        })
      })

      it('should not produce an error', function (ctx) {
        return new Promise(resolve => {
          ctx.call(() => {
            ctx.res.sendStatus.callCount.should.equal(0)
            ctx.res.sendStatus.calledWith(500).should.equal(false)
            ctx.res.sendStatus.calledWith(400).should.equal(false)
            resolve()
          })
        })
      })

      it('should still return data', function (ctx) {
        return new Promise(resolve => {
          ctx.call(() => {
            ctx.res.json.callCount.should.equal(1)
            ctx.res.json.calledWith(ctx.fakeResponseData).should.equal(true)
            resolve()
          })
        })
      })
    })

    describe('when shouldBroadcast is false', function () {
      beforeEach(function (ctx) {
        ctx.ReferencesHandler.index.callsArgWith(2, null, ctx.fakeResponseData)
        ctx.req.body.shouldBroadcast = false
      })

      it('should not call EditorRealTimeController.emitToRoom', function (ctx) {
        return new Promise(resolve => {
          ctx.call(() => {
            ctx.EditorRealTimeController.emitToRoom.callCount.should.equal(0)
            resolve()
          })
        })
      })

      it('should not produce an error', function (ctx) {
        return new Promise(resolve => {
          ctx.call(() => {
            ctx.res.sendStatus.callCount.should.equal(0)
            ctx.res.sendStatus.calledWith(500).should.equal(false)
            ctx.res.sendStatus.calledWith(400).should.equal(false)
            resolve()
          })
        })
      })

      it('should still return data', function (ctx) {
        return new Promise(resolve => {
          ctx.call(() => {
            ctx.res.json.callCount.should.equal(1)
            ctx.res.json.calledWith(ctx.fakeResponseData).should.equal(true)
            resolve()
          })
        })
      })
    })
  })

  describe('there is no data', function () {
    beforeEach(function (ctx) {
      ctx.ReferencesHandler.indexAll.callsArgWith(1)
      ctx.call = callback => {
        ctx.controller.indexAll(ctx.req, ctx.res, ctx.next)
        callback()
      }
    })

    it('should not call EditorRealTimeController.emitToRoom', function (ctx) {
      return new Promise(resolve => {
        ctx.call(() => {
          ctx.EditorRealTimeController.emitToRoom.callCount.should.equal(0)
          resolve()
        })
      })
    })

    it('should not produce an error', function (ctx) {
      return new Promise(resolve => {
        ctx.call(() => {
          ctx.res.sendStatus.callCount.should.equal(0)
          ctx.res.sendStatus.calledWith(500).should.equal(false)
          ctx.res.sendStatus.calledWith(400).should.equal(false)
          resolve()
        })
      })
    })

    it('should send a response with an empty keys list', function (ctx) {
      return new Promise(resolve => {
        ctx.call(() => {
          ctx.res.json.called.should.equal(true)
          ctx.res.json
            .calledWith({ projectId: ctx.projectId, keys: [] })
            .should.equal(true)
          resolve()
        })
      })
    })
  })
})

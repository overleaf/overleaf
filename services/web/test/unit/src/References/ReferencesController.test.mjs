import { vi } from 'vitest'
import sinon from 'sinon'
import MockRequest from '../helpers/MockRequest.mjs'
import MockResponse from '../helpers/MockResponse.mjs'
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
      '../../../../app/src/Features/Editor/EditorRealTimeController',
      () => ({
        default: (ctx.EditorRealTimeController = {
          emitToRoom: sinon.stub(),
        }),
      })
    )

    ctx.controller = (await import(modulePath)).default
    ctx.req = new MockRequest(vi)
    ctx.req.params.Project_id = ctx.projectId
    ctx.req.body = {
      docIds: (ctx.docIds = ['aaa', 'bbb']),
      shouldBroadcast: false,
    }
    ctx.res = new MockResponse(vi)
    ctx.res.json = sinon.stub()
    ctx.res.sendStatus = sinon.stub()
    ctx.next = sinon.stub()
    ctx.expectedResponseData = {
      projectId: ctx.projectId,
      keys: [],
    }
  })

  describe('indexAll', function () {
    beforeEach(function (ctx) {
      ctx.req.body = { shouldBroadcast: false }
      ctx.call = callback => {
        ctx.controller.indexAll(ctx.req, ctx.res, ctx.next)
        return callback()
      }
    })

    it('should not produce an error', async function (ctx) {
      await new Promise(resolve => {
        ctx.call(() => {
          ctx.res.sendStatus.callCount.should.equal(0)
          ctx.res.sendStatus.calledWith(500).should.equal(false)
          ctx.res.sendStatus.calledWith(400).should.equal(false)
          resolve()
        })
      })
    })

    it('should return expected empty data', async function (ctx) {
      await new Promise(resolve => {
        ctx.call(() => {
          ctx.res.json.callCount.should.equal(1)
          ctx.res.json.calledWith(ctx.expectedResponseData).should.equal(true)
          resolve()
        })
      })
    })

    describe('when shouldBroadcast is true', function () {
      beforeEach(function (ctx) {
        ctx.req.body.shouldBroadcast = true
      })

      it('should call EditorRealTimeController.emitToRoom', async function (ctx) {
        await new Promise(resolve => {
          ctx.call(() => {
            ctx.EditorRealTimeController.emitToRoom.callCount.should.equal(1)
            resolve()
          })
        })
      })

      it('should not produce an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.call(() => {
            ctx.res.sendStatus.callCount.should.equal(0)
            ctx.res.sendStatus.calledWith(500).should.equal(false)
            ctx.res.sendStatus.calledWith(400).should.equal(false)
            resolve()
          })
        })
      })

      it('should still return empty data', async function (ctx) {
        await new Promise(resolve => {
          ctx.call(() => {
            ctx.res.json.callCount.should.equal(1)
            ctx.res.json.calledWith(ctx.expectedResponseData).should.equal(true)
            resolve()
          })
        })
      })
    })

    describe('when shouldBroadcast is false', function () {
      beforeEach(function (ctx) {
        ctx.req.body.shouldBroadcast = false
      })

      it('should not call EditorRealTimeController.emitToRoom', async function (ctx) {
        await new Promise(resolve => {
          ctx.call(() => {
            ctx.EditorRealTimeController.emitToRoom.callCount.should.equal(0)
            resolve()
          })
        })
      })

      it('should not produce an error', async function (ctx) {
        await new Promise(resolve => {
          ctx.call(() => {
            ctx.res.sendStatus.callCount.should.equal(0)
            ctx.res.sendStatus.calledWith(500).should.equal(false)
            ctx.res.sendStatus.calledWith(400).should.equal(false)
            resolve()
          })
        })
      })

      it('should still return empty data', async function (ctx) {
        await new Promise(resolve => {
          ctx.call(() => {
            ctx.res.json.callCount.should.equal(1)
            ctx.res.json.calledWith(ctx.expectedResponseData).should.equal(true)
            resolve()
          })
        })
      })
    })
  })
})

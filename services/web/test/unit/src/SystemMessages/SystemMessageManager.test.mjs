import { vi } from 'vitest'
import sinon from 'sinon'

const modulePath =
  '../../../../app/src/Features/SystemMessages/SystemMessageManager.mjs'

describe('SystemMessageManager', function () {
  beforeEach(async function (ctx) {
    ctx.messages = ['messages-stub']
    ctx.SystemMessage = {
      find: sinon.stub().returns({
        exec: sinon.stub().resolves(ctx.messages),
      }),
    }

    vi.doMock('../../../../app/src/models/SystemMessage', () => ({
      SystemMessage: ctx.SystemMessage,
    }))

    ctx.SystemMessageManager = (await import(modulePath)).default
  })

  it('should look the messages up in the database on import', function (ctx) {
    sinon.assert.called(ctx.SystemMessage.find)
  })

  describe('getMessage', function () {
    beforeEach(function (ctx) {
      ctx.SystemMessageManager._cachedMessages = ctx.messages
      ctx.result = ctx.SystemMessageManager.getMessages()
    })

    it('should return the messages', function (ctx) {
      ctx.result.should.equal(ctx.messages)
    })
  })

  describe('clearMessages', function () {
    beforeEach(function (ctx) {
      ctx.SystemMessage.deleteMany = sinon.stub().returns({
        exec: sinon.stub().resolves(),
      })
      ctx.SystemMessageManager.promises.clearMessages()
    })

    it('should remove the messages from the database', function (ctx) {
      ctx.SystemMessage.deleteMany.calledWith({}).should.equal(true)
    })
  })
})

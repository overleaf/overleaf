const SandboxedModule = require('sandboxed-module')
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/SystemMessages/SystemMessageManager.js'
)

describe('SystemMessageManager', function () {
  beforeEach(function () {
    this.messages = ['messages-stub']
    this.SystemMessage = {
      find: sinon.stub().returns({
        exec: sinon.stub().resolves(this.messages),
      }),
    }
    this.SystemMessageManager = SandboxedModule.require(modulePath, {
      requires: {
        '../../models/SystemMessage': { SystemMessage: this.SystemMessage },
      },
    })
  })

  it('should look the messages up in the database on import', function () {
    sinon.assert.called(this.SystemMessage.find)
  })

  describe('getMessage', function () {
    beforeEach(function () {
      this.SystemMessageManager._cachedMessages = this.messages
      this.result = this.SystemMessageManager.getMessages()
    })

    it('should return the messages', function () {
      this.result.should.equal(this.messages)
    })
  })

  describe('clearMessages', function () {
    beforeEach(function () {
      this.SystemMessage.deleteMany = sinon.stub().returns({
        exec: sinon.stub().resolves(),
      })
      this.SystemMessageManager.promises.clearMessages()
    })

    it('should remove the messages from the database', function () {
      this.SystemMessage.deleteMany.calledWith({}).should.equal(true)
    })
  })
})

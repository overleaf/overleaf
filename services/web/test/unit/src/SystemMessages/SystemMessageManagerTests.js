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
const assert = require('assert')
require('chai').should()
const sinon = require('sinon')
const modulePath = require('path').join(
  __dirname,
  '../../../../app/src/Features/SystemMessages/SystemMessageManager.js'
)

describe('SystemMessageManager', function() {
  beforeEach(function() {
    this.SystemMessage = {}
    this.SystemMessageManager = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        '../../models/SystemMessage': { SystemMessage: this.SystemMessage }
      }
    })
    return (this.callback = sinon.stub())
  })

  describe('getMessage', function() {
    beforeEach(function() {
      this.messages = ['messages-stub']
      return (this.SystemMessage.find = sinon
        .stub()
        .callsArgWith(1, null, this.messages))
    })

    describe('when the messages are not cached', function() {
      beforeEach(function() {
        return this.SystemMessageManager.getMessages(this.callback)
      })

      it('should look the messages up in the database', function() {
        return this.SystemMessage.find.calledWith({}).should.equal(true)
      })

      it('should return the messages', function() {
        return this.callback.calledWith(null, this.messages).should.equal(true)
      })

      it('should cache the messages', function() {
        return this.SystemMessageManager._cachedMessages.should.equal(
          this.messages
        )
      })
    })

    describe('when the messages are cached', function() {
      beforeEach(function() {
        this.SystemMessageManager._cachedMessages = this.messages
        return this.SystemMessageManager.getMessages(this.callback)
      })

      it('should not look the messages up in the database', function() {
        return this.SystemMessage.find.called.should.equal(false)
      })

      it('should return the messages', function() {
        return this.callback.calledWith(null, this.messages).should.equal(true)
      })
    })
  })

  describe('clearMessages', function() {
    beforeEach(function() {
      this.SystemMessage.remove = sinon.stub().callsArg(1)
      return this.SystemMessageManager.clearMessages(this.callback)
    })

    it('should remove the messages from the database', function() {
      return this.SystemMessage.remove.calledWith({}).should.equal(true)
    })

    it('should return the callback', function() {
      return this.callback.called.should.equal(true)
    })
  })
})

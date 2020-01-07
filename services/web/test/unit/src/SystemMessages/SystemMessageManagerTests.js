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
    this.messages = ['messages-stub']
    this.SystemMessage = {
      find: sinon.stub().yields(null, this.messages)
    }
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

  it('should look the messages up in the database on import', function() {
    sinon.assert.called(this.SystemMessage.find)
  })

  describe('getMessage', function() {
    beforeEach(function() {
      this.SystemMessageManager._cachedMessages = this.messages
      return this.SystemMessageManager.getMessages(this.callback)
    })

    it('should return the messages', function() {
      return this.callback.calledWith(null, this.messages).should.equal(true)
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

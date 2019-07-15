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
const should = require('chai').should()
const SandboxedModule = require('sandboxed-module')
const assert = require('assert')
const path = require('path')
const sinon = require('sinon')
const modulePath = path.join(
  __dirname,
  '../../../../app/src/Features/Chat/ChatApiHandler'
)
const { expect } = require('chai')

describe('ChatApiHandler', function() {
  beforeEach(function() {
    this.settings = {
      apis: {
        chat: {
          internal_url: 'chat.sharelatex.env'
        }
      }
    }
    this.request = sinon.stub()
    this.ChatApiHandler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': this.settings,
        'logger-sharelatex': {
          log: sinon.stub(),
          warn: sinon.stub(),
          error: sinon.stub()
        },
        request: this.request
      }
    })
    this.project_id = '3213213kl12j'
    this.user_id = '2k3jlkjs9'
    this.content = 'my message here'
    return (this.callback = sinon.stub())
  })

  describe('sendGlobalMessage', function() {
    describe('successfully', function() {
      beforeEach(function() {
        this.message = { mock: 'message' }
        this.request.callsArgWith(1, null, { statusCode: 200 }, this.message)
        return this.ChatApiHandler.sendGlobalMessage(
          this.project_id,
          this.user_id,
          this.content,
          this.callback
        )
      })

      it('should post the data to the chat api', function() {
        return this.request
          .calledWith({
            url: `${this.settings.apis.chat.internal_url}/project/${
              this.project_id
            }/messages`,
            method: 'POST',
            json: {
              content: this.content,
              user_id: this.user_id
            }
          })
          .should.equal(true)
      })

      it('should return the message from the post', function() {
        return this.callback.calledWith(null, this.message).should.equal(true)
      })
    })

    describe('with a non-success status code', function() {
      beforeEach(function() {
        this.request.callsArgWith(1, null, { statusCode: 500 })
        return this.ChatApiHandler.sendGlobalMessage(
          this.project_id,
          this.user_id,
          this.content,
          this.callback
        )
      })

      it('should return an error', function() {
        const error = new Error()
        error.statusCode = 500
        return this.callback.calledWith(error).should.equal(true)
      })
    })
  })

  describe('getGlobalMessages', function() {
    beforeEach(function() {
      this.messages = [{ mock: 'message' }]
      this.limit = 30
      return (this.before = '1234')
    })

    describe('successfully', function() {
      beforeEach(function() {
        this.request.callsArgWith(1, null, { statusCode: 200 }, this.messages)
        return this.ChatApiHandler.getGlobalMessages(
          this.project_id,
          this.limit,
          this.before,
          this.callback
        )
      })

      it('should make get request for room to chat api', function() {
        return this.request
          .calledWith({
            method: 'GET',
            url: `${this.settings.apis.chat.internal_url}/project/${
              this.project_id
            }/messages`,
            qs: {
              limit: this.limit,
              before: this.before
            },
            json: true
          })
          .should.equal(true)
      })

      it('should return the messages from the request', function() {
        return this.callback.calledWith(null, this.messages).should.equal(true)
      })
    })

    describe('with failure error code', function() {
      beforeEach(function() {
        this.request.callsArgWith(1, null, { statusCode: 500 }, null)
        return this.ChatApiHandler.getGlobalMessages(
          this.project_id,
          this.limit,
          this.before,
          this.callback
        )
      })

      it('should return an error', function() {
        const error = new Error()
        error.statusCode = 500
        return this.callback.calledWith(error).should.equal(true)
      })
    })
  })
})

/* eslint-disable
    camelcase,
    max-len,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { ObjectId } = require('../../../app/js/mongojs')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Editing a message', function () {
  before(function (done) {
    this.project_id = ObjectId().toString()
    this.user_id = ObjectId().toString()
    this.thread_id = ObjectId().toString()
    return ChatApp.ensureRunning(done)
  })

  return describe('in a thread', function () {
    before(function (done) {
      this.content = 'thread message'
      this.new_content = 'updated thread message'
      return ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content,
        (error, response, message) => {
          this.message = message
          expect(error).to.be.null
          expect(response.statusCode).to.equal(201)
          expect(this.message.id).to.exist
          expect(this.message.content).to.equal(this.content)
          return ChatClient.editMessage(
            this.project_id,
            this.thread_id,
            this.message.id,
            this.new_content,
            (error, response, new_message) => {
              this.new_message = new_message
              expect(error).to.be.null
              expect(response.statusCode).to.equal(204)
              return done()
            }
          )
        }
      )
    })

    return it('should then list the updated message in the threads', function (done) {
      return ChatClient.getThreads(
        this.project_id,
        (error, response, threads) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(200)
          expect(threads[this.thread_id].messages.length).to.equal(1)
          expect(threads[this.thread_id].messages[0].content).to.equal(
            this.new_content
          )
          return done()
        }
      )
    })
  })
})

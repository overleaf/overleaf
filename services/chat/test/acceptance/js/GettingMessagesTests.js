/* eslint-disable
    handle-callback-err,
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')
const async = require('async')
const crypto = require('crypto')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Getting messages', function () {
  before(function (done) {
    this.user_id1 = ObjectId().toString()
    this.user_id2 = ObjectId().toString()
    this.content1 = 'foo bar'
    this.content2 = 'hello world'
    return ChatApp.ensureRunning(done)
  })

  describe('globally', function () {
    before(function (done) {
      this.project_id = ObjectId().toString()
      return async.series(
        [
          cb =>
            ChatClient.sendGlobalMessage(
              this.project_id,
              this.user_id1,
              this.content1,
              cb
            ),
          cb =>
            ChatClient.sendGlobalMessage(
              this.project_id,
              this.user_id2,
              this.content2,
              cb
            ),
        ],
        done
      )
    })

    return it('should contain the messages and populated users when getting the messages', function (done) {
      return ChatClient.getGlobalMessages(
        this.project_id,
        (error, response, messages) => {
          expect(messages.length).to.equal(2)
          messages.reverse()
          expect(messages[0].content).to.equal(this.content1)
          expect(messages[0].user_id).to.equal(this.user_id1)
          expect(messages[1].content).to.equal(this.content2)
          expect(messages[1].user_id).to.equal(this.user_id2)
          return done()
        }
      )
    })
  })

  return describe('from all the threads', function () {
    before(function (done) {
      this.project_id = ObjectId().toString()
      this.thread_id1 = ObjectId().toString()
      this.thread_id2 = ObjectId().toString()
      return async.series(
        [
          cb =>
            ChatClient.sendMessage(
              this.project_id,
              this.thread_id1,
              this.user_id1,
              'one',
              cb
            ),
          cb =>
            ChatClient.sendMessage(
              this.project_id,
              this.thread_id2,
              this.user_id2,
              'two',
              cb
            ),
          cb =>
            ChatClient.sendMessage(
              this.project_id,
              this.thread_id1,
              this.user_id1,
              'three',
              cb
            ),
          cb =>
            ChatClient.sendMessage(
              this.project_id,
              this.thread_id2,
              this.user_id2,
              'four',
              cb
            ),
        ],
        done
      )
    })

    return it('should contain a dictionary of threads with messages with populated users', function (done) {
      return ChatClient.getThreads(
        this.project_id,
        (error, response, threads) => {
          expect(Object.keys(threads).length).to.equal(2)
          const thread1 = threads[this.thread_id1]
          expect(thread1.messages.length).to.equal(2)
          const thread2 = threads[this.thread_id2]
          expect(thread2.messages.length).to.equal(2)

          expect(thread1.messages[0].content).to.equal('one')
          expect(thread1.messages[0].user_id).to.equal(this.user_id1)
          expect(thread1.messages[1].content).to.equal('three')
          expect(thread1.messages[1].user_id).to.equal(this.user_id1)

          expect(thread2.messages[0].content).to.equal('two')
          expect(thread2.messages[0].user_id).to.equal(this.user_id2)
          expect(thread2.messages[1].content).to.equal('four')
          expect(thread2.messages[1].user_id).to.equal(this.user_id2)
          return done()
        }
      )
    })
  })
})

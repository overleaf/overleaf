/* eslint-disable
    handle-callback-err,
    max-len,
    no-return-assign,
    node/no-deprecated-api,
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

describe('Sending a message', function() {
  before(done => ChatApp.ensureRunning(done))

  describe('globally', function() {
    before(function(done) {
      this.project_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      this.content = 'global message'
      return ChatClient.sendGlobalMessage(
        this.project_id,
        this.user_id,
        this.content,
        (error, response, body) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(201)
          expect(body.content).to.equal(this.content)
          expect(body.user_id).to.equal(this.user_id)
          expect(body.room_id).to.equal(this.project_id)
          return done()
        }
      )
    })

    return it('should then list the message in the project messages', function(done) {
      return ChatClient.getGlobalMessages(
        this.project_id,
        (error, response, messages) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(200)
          expect(messages.length).to.equal(1)
          expect(messages[0].content).to.equal(this.content)
          return done()
        }
      )
    })
  })

  describe('to a thread', function() {
    before(function(done) {
      this.project_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      this.thread_id = ObjectId().toString()
      this.content = 'thread message'
      return ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content,
        (error, response, body) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(201)
          expect(body.content).to.equal(this.content)
          expect(body.user_id).to.equal(this.user_id)
          expect(body.room_id).to.equal(this.project_id)
          return done()
        }
      )
    })

    it('should then list the message in the threads', function(done) {
      return ChatClient.getThreads(
        this.project_id,
        (error, response, threads) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(200)
          expect(threads[this.thread_id].messages.length).to.equal(1)
          expect(threads[this.thread_id].messages[0].content).to.equal(
            this.content
          )
          return done()
        }
      )
    })

    return it('should not appear in the global messages', function(done) {
      return ChatClient.getGlobalMessages(
        this.project_id,
        (error, response, messages) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(200)
          expect(messages.length).to.equal(0)
          return done()
        }
      )
    })
  })

  return describe('failure cases', function() {
    before(function() {
      this.project_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      return (this.thread_id = ObjectId().toString())
    })

    describe('with a malformed user_id', () =>
      it('should return a graceful error', function(done) {
        return ChatClient.sendMessage(
          this.project_id,
          this.thread_id,
          'malformed-user',
          'content',
          (error, response, body) => {
            expect(response.statusCode).to.equal(400)
            expect(body).to.equal('Invalid user_id')
            return done()
          }
        )
      }))

    describe('with a malformed project_id', () =>
      it('should return a graceful error', function(done) {
        return ChatClient.sendMessage(
          'malformed-project',
          this.thread_id,
          this.user_id,
          'content',
          (error, response, body) => {
            expect(response.statusCode).to.equal(400)
            expect(body).to.equal('Invalid project_id')
            return done()
          }
        )
      }))

    describe('with a malformed thread_id', () =>
      it('should return a graceful error', function(done) {
        return ChatClient.sendMessage(
          this.project_id,
          'malformed-thread-id',
          this.user_id,
          'content',
          (error, response, body) => {
            expect(response.statusCode).to.equal(400)
            expect(body).to.equal('Invalid thread_id')
            return done()
          }
        )
      }))

    describe('with no content', () =>
      it('should return a graceful error', function(done) {
        return ChatClient.sendMessage(
          this.project_id,
          this.thread_id,
          this.user_id,
          null,
          (error, response, body) => {
            expect(response.statusCode).to.equal(400)
            expect(body).to.equal('No content provided')
            return done()
          }
        )
      }))

    return describe('with very long content', () =>
      it('should return a graceful error', function(done) {
        const content = new Buffer(10240).toString('hex')
        return ChatClient.sendMessage(
          this.project_id,
          this.thread_id,
          this.user_id,
          content,
          (error, response, body) => {
            expect(response.statusCode).to.equal(400)
            expect(body).to.equal('Content too long (> 10240 bytes)')
            return done()
          }
        )
      }))
  })
})

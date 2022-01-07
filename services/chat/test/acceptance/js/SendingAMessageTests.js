const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Sending a message', function () {
  before(function (done) {
    ChatApp.ensureRunning(done)
  })

  describe('globally', function () {
    before(function (done) {
      this.project_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      this.content = 'global message'
      ChatClient.sendGlobalMessage(
        this.project_id,
        this.user_id,
        this.content,
        (error, response, body) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(201)
          expect(body.content).to.equal(this.content)
          expect(body.user_id).to.equal(this.user_id)
          expect(body.room_id).to.equal(this.project_id)
          done()
        }
      )
    })

    it('should then list the message in the project messages', function (done) {
      ChatClient.getGlobalMessages(
        this.project_id,
        (error, response, messages) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(200)
          expect(messages.length).to.equal(1)
          expect(messages[0].content).to.equal(this.content)
          done()
        }
      )
    })
  })

  describe('to a thread', function () {
    before(function (done) {
      this.project_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      this.thread_id = ObjectId().toString()
      this.content = 'thread message'
      ChatClient.sendMessage(
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
          done()
        }
      )
    })

    it('should then list the message in the threads', function (done) {
      ChatClient.getThreads(this.project_id, (error, response, threads) => {
        expect(error).to.be.null
        expect(response.statusCode).to.equal(200)
        expect(threads[this.thread_id].messages.length).to.equal(1)
        expect(threads[this.thread_id].messages[0].content).to.equal(
          this.content
        )
        done()
      })
    })

    it('should not appear in the global messages', function (done) {
      ChatClient.getGlobalMessages(
        this.project_id,
        (error, response, messages) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(200)
          expect(messages.length).to.equal(0)
          done()
        }
      )
    })
  })

  describe('failure cases', function () {
    before(function () {
      this.project_id = ObjectId().toString()
      this.user_id = ObjectId().toString()
      this.thread_id = ObjectId().toString()
    })

    describe('with a malformed user_id', function () {
      it('should return a graceful error', function (done) {
        ChatClient.sendMessage(
          this.project_id,
          this.thread_id,
          'malformed-user',
          'content',
          (error, response, body) => {
            if (error) return done(error)
            expect(response.statusCode).to.equal(400)
            expect(body).to.equal('Invalid userId')
            done()
          }
        )
      })
    })

    describe('with a malformed project_id', function () {
      it('should return a graceful error', function (done) {
        ChatClient.sendMessage(
          'malformed-project',
          this.thread_id,
          this.user_id,
          'content',
          (error, response, body) => {
            if (error) return done(error)
            expect(response.statusCode).to.equal(400)
            expect(body).to.equal('Invalid projectId')
            done()
          }
        )
      })
    })

    describe('with a malformed thread_id', function () {
      it('should return a graceful error', function (done) {
        ChatClient.sendMessage(
          this.project_id,
          'malformed-thread-id',
          this.user_id,
          'content',
          (error, response, body) => {
            if (error) return done(error)
            expect(response.statusCode).to.equal(400)
            expect(body).to.equal('Invalid threadId')
            done()
          }
        )
      })
    })

    describe('with no content', function () {
      it('should return a graceful error', function (done) {
        ChatClient.sendMessage(
          this.project_id,
          this.thread_id,
          this.user_id,
          null,
          (error, response, body) => {
            if (error) return done(error)
            expect(response.statusCode).to.equal(400)
            expect(body).to.equal('No content provided')
            done()
          }
        )
      })
    })

    describe('with very long content', function () {
      it('should return a graceful error', function (done) {
        const content = '-'.repeat(10 * 1024 + 1)
        ChatClient.sendMessage(
          this.project_id,
          this.thread_id,
          this.user_id,
          content,
          (error, response, body) => {
            if (error) return done(error)
            expect(response.statusCode).to.equal(400)
            expect(body).to.equal('Content too long (> 10240 bytes)')
            done()
          }
        )
      })
    })
  })
})

const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Resolving a thread', function () {
  before(function (done) {
    this.project_id = ObjectId().toString()
    this.user_id = ObjectId().toString()
    ChatApp.ensureRunning(done)
  })

  describe('with a resolved thread', function () {
    before(function (done) {
      this.thread_id = ObjectId().toString()
      this.content = 'resolved message'
      ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content,
        (error, response, body) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(201)
          ChatClient.resolveThread(
            this.project_id,
            this.thread_id,
            this.user_id,
            (error, response, body) => {
              expect(error).to.be.null
              expect(response.statusCode).to.equal(204)
              done()
            }
          )
        }
      )
    })

    it('should then list the thread as resolved', function (done) {
      ChatClient.getThreads(this.project_id, (error, response, threads) => {
        expect(error).to.be.null
        expect(response.statusCode).to.equal(200)
        expect(threads[this.thread_id].resolved).to.equal(true)
        expect(threads[this.thread_id].resolved_by_user_id).to.equal(
          this.user_id
        )
        const resolvedAt = new Date(threads[this.thread_id].resolved_at)
        expect(new Date() - resolvedAt).to.be.below(1000)
        done()
      })
    })
  })

  describe('when a thread is not resolved', function () {
    before(function (done) {
      this.thread_id = ObjectId().toString()
      this.content = 'open message'
      ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content,
        (error, response, body) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(201)
          done()
        }
      )
    })

    it('should not list the thread as resolved', function (done) {
      ChatClient.getThreads(this.project_id, (error, response, threads) => {
        expect(error).to.be.null
        expect(response.statusCode).to.equal(200)
        expect(threads[this.thread_id].resolved).to.be.undefined
        done()
      })
    })
  })

  describe('when a thread is resolved then reopened', function () {
    before(function (done) {
      this.thread_id = ObjectId().toString()
      this.content = 'resolved message'
      ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content,
        (error, response, body) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(201)
          ChatClient.resolveThread(
            this.project_id,
            this.thread_id,
            this.user_id,
            (error, response, body) => {
              expect(error).to.be.null
              expect(response.statusCode).to.equal(204)
              ChatClient.reopenThread(
                this.project_id,
                this.thread_id,
                (error, response, body) => {
                  expect(error).to.be.null
                  expect(response.statusCode).to.equal(204)
                  done()
                }
              )
            }
          )
        }
      )
    })

    it('should not list the thread as resolved', function (done) {
      ChatClient.getThreads(this.project_id, (error, response, threads) => {
        expect(error).to.be.null
        expect(response.statusCode).to.equal(200)
        expect(threads[this.thread_id].resolved).to.be.undefined
        done()
      })
    })
  })
})

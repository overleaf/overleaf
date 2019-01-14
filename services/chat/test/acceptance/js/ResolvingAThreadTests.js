/* eslint-disable
    camelcase,
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
const { ObjectId } = require('../../../app/js/mongojs')
const { expect } = require('chai')
const crypto = require('crypto')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Resolving a thread', function() {
  before(function(done) {
    this.project_id = ObjectId().toString()
    this.user_id = ObjectId().toString()
    return ChatApp.ensureRunning(done)
  })

  describe('with a resolved thread', function() {
    before(function(done) {
      this.thread_id = ObjectId().toString()
      this.content = 'resolved message'
      return ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content,
        (error, response, body) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(201)
          return ChatClient.resolveThread(
            this.project_id,
            this.thread_id,
            this.user_id,
            (error, response, body) => {
              expect(error).to.be.null
              expect(response.statusCode).to.equal(204)
              return done()
            }
          )
        }
      )
    })

    return it('should then list the thread as resolved', function(done) {
      return ChatClient.getThreads(
        this.project_id,
        (error, response, threads) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(200)
          expect(threads[this.thread_id].resolved).to.equal(true)
          expect(threads[this.thread_id].resolved_by_user_id).to.equal(
            this.user_id
          )
          const resolved_at = new Date(threads[this.thread_id].resolved_at)
          expect(new Date() - resolved_at).to.be.below(1000)
          return done()
        }
      )
    })
  })

  describe('when a thread is not resolved', function() {
    before(function(done) {
      this.thread_id = ObjectId().toString()
      this.content = 'open message'
      return ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content,
        (error, response, body) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(201)
          return done()
        }
      )
    })

    return it('should not list the thread as resolved', function(done) {
      return ChatClient.getThreads(
        this.project_id,
        (error, response, threads) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(200)
          expect(threads[this.thread_id].resolved).to.be.undefined
          return done()
        }
      )
    })
  })

  return describe('when a thread is resolved then reopened', function() {
    before(function(done) {
      this.thread_id = ObjectId().toString()
      this.content = 'resolved message'
      return ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content,
        (error, response, body) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(201)
          return ChatClient.resolveThread(
            this.project_id,
            this.thread_id,
            this.user_id,
            (error, response, body) => {
              expect(error).to.be.null
              expect(response.statusCode).to.equal(204)
              return ChatClient.reopenThread(
                this.project_id,
                this.thread_id,
                (error, response, body) => {
                  expect(error).to.be.null
                  expect(response.statusCode).to.equal(204)
                  return done()
                }
              )
            }
          )
        }
      )
    })

    return it('should not list the thread as resolved', function(done) {
      return ChatClient.getThreads(
        this.project_id,
        (error, response, threads) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(200)
          expect(threads[this.thread_id].resolved).to.be.undefined
          return done()
        }
      )
    })
  })
})

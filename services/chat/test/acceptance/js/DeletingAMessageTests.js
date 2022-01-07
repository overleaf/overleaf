const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Deleting a message', function () {
  before(function (done) {
    this.project_id = ObjectId().toString()
    this.user_id = ObjectId().toString()
    this.thread_id = ObjectId().toString()
    ChatApp.ensureRunning(done)
  })

  describe('in a thread', function () {
    before(function (done) {
      ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        'first message',
        (error, response, message) => {
          this.message = message
          expect(error).to.be.null
          expect(response.statusCode).to.equal(201)
          ChatClient.sendMessage(
            this.project_id,
            this.thread_id,
            this.user_id,
            'deleted message',
            (error, response, message1) => {
              this.message = message1
              expect(error).to.be.null
              expect(response.statusCode).to.equal(201)
              ChatClient.deleteMessage(
                this.project_id,
                this.thread_id,
                this.message.id,
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

    it('should then remove the message from the threads', function (done) {
      ChatClient.getThreads(this.project_id, (error, response, threads) => {
        expect(error).to.be.null
        expect(response.statusCode).to.equal(200)
        expect(threads[this.thread_id].messages.length).to.equal(1)
        done()
      })
    })
  })
})

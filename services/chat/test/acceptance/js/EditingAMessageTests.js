const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Editing a message', function () {
  before(function (done) {
    this.project_id = ObjectId().toString()
    this.user_id = ObjectId().toString()
    this.thread_id = ObjectId().toString()
    ChatApp.ensureRunning(done)
  })

  describe('in a thread', function () {
    before(function (done) {
      this.content = 'thread message'
      this.new_content = 'updated thread message'
      ChatClient.sendMessage(
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
          ChatClient.editMessage(
            this.project_id,
            this.thread_id,
            this.message.id,
            this.new_content,
            (error, response, newMessage) => {
              this.new_message = newMessage
              expect(error).to.be.null
              expect(response.statusCode).to.equal(204)
              done()
            }
          )
        }
      )
    })

    it('should then list the updated message in the threads', function (done) {
      ChatClient.getThreads(this.project_id, (error, response, threads) => {
        expect(error).to.be.null
        expect(response.statusCode).to.equal(200)
        expect(threads[this.thread_id].messages.length).to.equal(1)
        expect(threads[this.thread_id].messages[0].content).to.equal(
          this.new_content
        )
        done()
      })
    })
  })
})

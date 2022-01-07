const { ObjectId } = require('../../../app/js/mongodb')
const { expect } = require('chai')

const ChatClient = require('./helpers/ChatClient')
const ChatApp = require('./helpers/ChatApp')

describe('Deleting a thread', function () {
  before(function (done) {
    this.project_id = ObjectId().toString()
    this.user_id = ObjectId().toString()
    ChatApp.ensureRunning(done)
  })

  describe('with a thread that is deleted', function () {
    before(function (done) {
      this.thread_id = ObjectId().toString()
      this.content = 'deleted thread message'
      ChatClient.sendMessage(
        this.project_id,
        this.thread_id,
        this.user_id,
        this.content,
        (error, response, body) => {
          expect(error).to.be.null
          expect(response.statusCode).to.equal(201)
          ChatClient.deleteThread(
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
    })

    it('should then not list the thread for the project', function (done) {
      ChatClient.getThreads(this.project_id, (error, response, threads) => {
        expect(error).to.be.null
        expect(response.statusCode).to.equal(200)
        expect(Object.keys(threads).length).to.equal(0)
        done()
      })
    })
  })
})

/* eslint-disable
    no-return-assign,
    no-unused-vars,
    promise/param-names,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const { expect } = require('chai')
const sinon = require('sinon')
const modulePath = '../../../app/js/RoomManager.js'
const SandboxedModule = require('sandboxed-module')

describe('RoomManager', function () {
  beforeEach(function () {
    this.project_id = 'project-id-123'
    this.doc_id = 'doc-id-456'
    this.other_doc_id = 'doc-id-789'
    this.client = { namespace: { name: '' }, id: 'first-client' }
    this.RoomManager = SandboxedModule.require(modulePath, {
      requires: {
        '@overleaf/settings': (this.settings = {}),
        '@overleaf/metrics': (this.metrics = { gauge: sinon.stub() }),
      },
    })
    this.RoomManager._clientsInRoom = sinon.stub()
    this.RoomManager._clientAlreadyInRoom = sinon.stub()
    this.RoomEvents = this.RoomManager.eventSource()
    sinon.spy(this.RoomEvents, 'emit')
    return sinon.spy(this.RoomEvents, 'once')
  })

  describe('emitOnCompletion', function () {
    return describe('when a subscribe errors', function () {
      afterEach(function () {
        return process.removeListener('unhandledRejection', this.onUnhandled)
      })

      beforeEach(function (done) {
        this.onUnhandled = error => {
          this.unhandledError = error
          return done(new Error(`unhandledRejection: ${error.message}`))
        }
        process.on('unhandledRejection', this.onUnhandled)

        let reject
        const subscribePromise = new Promise((_, r) => (reject = r))
        const promises = [subscribePromise]
        const eventName = 'project-subscribed-123'
        this.RoomEvents.once(eventName, () => setTimeout(done, 100))
        this.RoomManager.emitOnCompletion(promises, eventName)
        return setTimeout(() => reject(new Error('subscribe failed')))
      })

      return it('should keep going', function () {
        return expect(this.unhandledError).to.not.exist
      })
    })
  })

  describe('joinProject', function () {
    describe('when the project room is empty', function () {
      beforeEach(function (done) {
        this.RoomManager._clientsInRoom
          .withArgs(this.client, this.project_id)
          .onFirstCall()
          .returns(0)
        this.client.join = sinon.stub()
        this.callback = sinon.stub()
        this.RoomEvents.on('project-active', id => {
          return setTimeout(() => {
            return this.RoomEvents.emit(`project-subscribed-${id}`)
          }, 100)
        })
        return this.RoomManager.joinProject(
          this.client,
          this.project_id,
          err => {
            this.callback(err)
            return done()
          }
        )
      })

      it("should emit a 'project-active' event with the id", function () {
        return this.RoomEvents.emit
          .calledWithExactly('project-active', this.project_id)
          .should.equal(true)
      })

      it("should listen for the 'project-subscribed-id' event", function () {
        return this.RoomEvents.once
          .calledWith(`project-subscribed-${this.project_id}`)
          .should.equal(true)
      })

      return it('should join the room using the id', function () {
        return this.client.join
          .calledWithExactly(this.project_id)
          .should.equal(true)
      })
    })

    return describe('when there are other clients in the project room', function () {
      beforeEach(function (done) {
        this.RoomManager._clientsInRoom
          .withArgs(this.client, this.project_id)
          .onFirstCall()
          .returns(123)
          .onSecondCall()
          .returns(124)
        this.client.join = sinon.stub()
        this.RoomManager.joinProject(this.client, this.project_id, done)
      })

      it('should join the room using the id', function () {
        return this.client.join.called.should.equal(true)
      })

      return it('should not emit any events', function () {
        return this.RoomEvents.emit.called.should.equal(false)
      })
    })
  })

  describe('joinDoc', function () {
    describe('when the doc room is empty', function () {
      beforeEach(function (done) {
        this.RoomManager._clientsInRoom
          .withArgs(this.client, this.doc_id)
          .onFirstCall()
          .returns(0)
        this.client.join = sinon.stub()
        this.callback = sinon.stub()
        this.RoomEvents.on('doc-active', id => {
          return setTimeout(() => {
            return this.RoomEvents.emit(`doc-subscribed-${id}`)
          }, 100)
        })
        return this.RoomManager.joinDoc(this.client, this.doc_id, err => {
          this.callback(err)
          return done()
        })
      })

      it("should emit a 'doc-active' event with the id", function () {
        return this.RoomEvents.emit
          .calledWithExactly('doc-active', this.doc_id)
          .should.equal(true)
      })

      it("should listen for the 'doc-subscribed-id' event", function () {
        return this.RoomEvents.once
          .calledWith(`doc-subscribed-${this.doc_id}`)
          .should.equal(true)
      })

      return it('should join the room using the id', function () {
        return this.client.join
          .calledWithExactly(this.doc_id)
          .should.equal(true)
      })
    })

    return describe('when there are other clients in the doc room', function () {
      beforeEach(function (done) {
        this.RoomManager._clientsInRoom
          .withArgs(this.client, this.doc_id)
          .onFirstCall()
          .returns(123)
          .onSecondCall()
          .returns(124)
        this.client.join = sinon.stub()
        this.RoomManager.joinDoc(this.client, this.doc_id, done)
      })

      it('should join the room using the id', function () {
        return this.client.join.called.should.equal(true)
      })

      return it('should not emit any events', function () {
        return this.RoomEvents.emit.called.should.equal(false)
      })
    })
  })

  describe('leaveDoc', function () {
    describe('when doc room will be empty after this client has left', function () {
      beforeEach(function () {
        this.RoomManager._clientAlreadyInRoom
          .withArgs(this.client, this.doc_id)
          .returns(true)
        this.RoomManager._clientsInRoom
          .withArgs(this.client, this.doc_id)
          .onCall(0)
          .returns(0)
        this.client.leave = sinon.stub()
        return this.RoomManager.leaveDoc(this.client, this.doc_id)
      })

      it('should leave the room using the id', function () {
        return this.client.leave
          .calledWithExactly(this.doc_id)
          .should.equal(true)
      })

      return it("should emit a 'doc-empty' event with the id", function () {
        return this.RoomEvents.emit
          .calledWithExactly('doc-empty', this.doc_id)
          .should.equal(true)
      })
    })

    describe('when there are other clients in the doc room', function () {
      beforeEach(function () {
        this.RoomManager._clientAlreadyInRoom
          .withArgs(this.client, this.doc_id)
          .returns(true)
        this.RoomManager._clientsInRoom
          .withArgs(this.client, this.doc_id)
          .onCall(0)
          .returns(123)
        this.client.leave = sinon.stub()
        return this.RoomManager.leaveDoc(this.client, this.doc_id)
      })

      it('should leave the room using the id', function () {
        return this.client.leave
          .calledWithExactly(this.doc_id)
          .should.equal(true)
      })

      return it('should not emit any events', function () {
        return this.RoomEvents.emit.called.should.equal(false)
      })
    })

    return describe('when the client is not in the doc room', function () {
      beforeEach(function () {
        this.RoomManager._clientAlreadyInRoom
          .withArgs(this.client, this.doc_id)
          .returns(false)
        this.RoomManager._clientsInRoom
          .withArgs(this.client, this.doc_id)
          .onCall(0)
          .returns(0)
        this.client.leave = sinon.stub()
        return this.RoomManager.leaveDoc(this.client, this.doc_id)
      })

      it('should not leave the room', function () {
        return this.client.leave.called.should.equal(false)
      })

      return it('should not emit any events', function () {
        return this.RoomEvents.emit.called.should.equal(false)
      })
    })
  })

  return describe('leaveProjectAndDocs', function () {
    return describe('when the client is connected to the project and multiple docs', function () {
      beforeEach(function () {
        this.RoomManager._roomsClientIsIn = sinon
          .stub()
          .returns([this.project_id, this.doc_id, this.other_doc_id])
        this.client.join = sinon.stub()
        return (this.client.leave = sinon.stub())
      })

      describe('when this is the only client connected', function () {
        beforeEach(function (done) {
          // first call is for the join,
          // second for the leave
          this.RoomManager._clientsInRoom
            .withArgs(this.client, this.doc_id)
            .onCall(0)
            .returns(0)
            .onCall(1)
            .returns(0)
          this.RoomManager._clientsInRoom
            .withArgs(this.client, this.other_doc_id)
            .onCall(0)
            .returns(0)
            .onCall(1)
            .returns(0)
          this.RoomManager._clientsInRoom
            .withArgs(this.client, this.project_id)
            .onCall(0)
            .returns(0)
            .onCall(1)
            .returns(0)
          this.RoomManager._clientAlreadyInRoom
            .withArgs(this.client, this.doc_id)
            .returns(true)
            .withArgs(this.client, this.other_doc_id)
            .returns(true)
            .withArgs(this.client, this.project_id)
            .returns(true)
          this.RoomEvents.on('project-active', id => {
            return setTimeout(() => {
              return this.RoomEvents.emit(`project-subscribed-${id}`)
            }, 100)
          })
          this.RoomEvents.on('doc-active', id => {
            return setTimeout(() => {
              return this.RoomEvents.emit(`doc-subscribed-${id}`)
            }, 100)
          })
          // put the client in the rooms
          return this.RoomManager.joinProject(
            this.client,
            this.project_id,
            () => {
              return this.RoomManager.joinDoc(this.client, this.doc_id, () => {
                return this.RoomManager.joinDoc(
                  this.client,
                  this.other_doc_id,
                  () => {
                    // now leave the project
                    this.RoomManager.leaveProjectAndDocs(this.client)
                    return done()
                  }
                )
              })
            }
          )
        })

        it('should leave all the docs', function () {
          this.client.leave.calledWithExactly(this.doc_id).should.equal(true)
          return this.client.leave
            .calledWithExactly(this.other_doc_id)
            .should.equal(true)
        })

        it('should leave the project', function () {
          return this.client.leave
            .calledWithExactly(this.project_id)
            .should.equal(true)
        })

        it("should emit a 'doc-empty' event with the id for each doc", function () {
          this.RoomEvents.emit
            .calledWithExactly('doc-empty', this.doc_id)
            .should.equal(true)
          return this.RoomEvents.emit
            .calledWithExactly('doc-empty', this.other_doc_id)
            .should.equal(true)
        })

        return it("should emit a 'project-empty' event with the id for the project", function () {
          return this.RoomEvents.emit
            .calledWithExactly('project-empty', this.project_id)
            .should.equal(true)
        })
      })

      return describe('when other clients are still connected', function () {
        beforeEach(function () {
          this.RoomManager._clientsInRoom
            .withArgs(this.client, this.doc_id)
            .onFirstCall()
            .returns(123)
            .onSecondCall()
            .returns(122)
          this.RoomManager._clientsInRoom
            .withArgs(this.client, this.other_doc_id)
            .onFirstCall()
            .returns(123)
            .onSecondCall()
            .returns(122)
          this.RoomManager._clientsInRoom
            .withArgs(this.client, this.project_id)
            .onFirstCall()
            .returns(123)
            .onSecondCall()
            .returns(122)
          this.RoomManager._clientAlreadyInRoom
            .withArgs(this.client, this.doc_id)
            .returns(true)
            .withArgs(this.client, this.other_doc_id)
            .returns(true)
            .withArgs(this.client, this.project_id)
            .returns(true)
          return this.RoomManager.leaveProjectAndDocs(this.client)
        })

        it('should leave all the docs', function () {
          this.client.leave.calledWithExactly(this.doc_id).should.equal(true)
          return this.client.leave
            .calledWithExactly(this.other_doc_id)
            .should.equal(true)
        })

        it('should leave the project', function () {
          return this.client.leave
            .calledWithExactly(this.project_id)
            .should.equal(true)
        })

        return it('should not emit any events', function () {
          return this.RoomEvents.emit.called.should.equal(false)
        })
      })
    })
  })
})

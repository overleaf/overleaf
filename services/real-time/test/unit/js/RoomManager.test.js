import { vi, expect, describe, beforeEach, afterEach, it } from 'vitest'

import sinon from 'sinon'
const modulePath = '../../../app/js/RoomManager.js'

describe('RoomManager', function () {
  beforeEach(async function (ctx) {
    ctx.project_id = 'project-id-123'
    ctx.doc_id = 'doc-id-456'
    ctx.other_doc_id = 'doc-id-789'
    ctx.client = { namespace: { name: '' }, id: 'first-client' }

    vi.doMock('@overleaf/settings', () => ({
      default: (ctx.settings = {}),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.metrics = { gauge: sinon.stub() }),
    }))

    ctx.RoomManager = (await import(modulePath)).default
    ctx.RoomManager._clientsInRoom = sinon.stub()
    ctx.RoomManager._clientAlreadyInRoom = sinon.stub()
    ctx.RoomEvents = ctx.RoomManager.eventSource()
    sinon.spy(ctx.RoomEvents, 'emit')
    sinon.spy(ctx.RoomEvents, 'once')
  })

  describe('emitOnCompletion', function () {
    describe('when a subscribe errors', function () {
      afterEach(function (ctx) {
        process.removeListener('unhandledRejection', ctx.onUnhandled)
      })

      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.onUnhandled = error => {
            ctx.unhandledError = error
            reject(new Error(`unhandledRejection: ${error.message}`))
          }
          process.on('unhandledRejection', ctx.onUnhandled)

          let rejectSubscribePromise
          const subscribePromise = new Promise(
            // eslint-disable-next-line promise/param-names
            (_, r) => (rejectSubscribePromise = r)
          )
          const promises = [subscribePromise]
          const eventName = 'project-subscribed-123'
          ctx.RoomEvents.once(eventName, () => setTimeout(resolve, 100))
          ctx.RoomManager.emitOnCompletion(promises, eventName)
          setTimeout(() =>
            rejectSubscribePromise(new Error('subscribe failed'))
          )
        })
      })

      it('should keep going', function (ctx) {
        expect(ctx.unhandledError).to.not.exist
      })
    })
  })

  describe('joinProject', function () {
    describe('when the project room is empty', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.RoomManager._clientsInRoom
            .withArgs(ctx.client, ctx.project_id)
            .onFirstCall()
            .returns(0)
          ctx.client.join = sinon.stub()
          ctx.callback = sinon.stub()
          ctx.RoomEvents.on('project-active', id => {
            setTimeout(() => {
              ctx.RoomEvents.emit(`project-subscribed-${id}`)
            }, 100)
          })
          ctx.RoomManager.joinProject(ctx.client, ctx.project_id, err => {
            ctx.callback(err)
            resolve()
          })
        })
      })

      it("should emit a 'project-active' event with the id", function (ctx) {
        ctx.RoomEvents.emit
          .calledWithExactly('project-active', ctx.project_id)
          .should.equal(true)
      })

      it("should listen for the 'project-subscribed-id' event", function (ctx) {
        ctx.RoomEvents.once
          .calledWith(`project-subscribed-${ctx.project_id}`)
          .should.equal(true)
      })

      it('should join the room using the id', function (ctx) {
        ctx.client.join.calledWithExactly(ctx.project_id).should.equal(true)
      })
    })

    describe('when there are other clients in the project room', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.RoomManager._clientsInRoom
            .withArgs(ctx.client, ctx.project_id)
            .onFirstCall()
            .returns(123)
            .onSecondCall()
            .returns(124)
          ctx.client.join = sinon.stub()
          ctx.RoomManager.joinProject(ctx.client, ctx.project_id, err => {
            if (err) return reject(err)
            resolve()
          })
        })
      })

      it('should join the room using the id', function (ctx) {
        ctx.client.join.called.should.equal(true)
      })

      it('should not emit any events', function (ctx) {
        ctx.RoomEvents.emit.called.should.equal(false)
      })
    })
  })

  describe('joinDoc', function () {
    describe('when the doc room is empty', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.RoomManager._clientsInRoom
            .withArgs(ctx.client, ctx.doc_id)
            .onFirstCall()
            .returns(0)
          ctx.client.join = sinon.stub()
          ctx.callback = sinon.stub()
          ctx.RoomEvents.on('doc-active', id => {
            setTimeout(() => {
              ctx.RoomEvents.emit(`doc-subscribed-${id}`)
            }, 100)
          })
          ctx.RoomManager.joinDoc(ctx.client, ctx.doc_id, err => {
            ctx.callback(err)
            resolve()
          })
        })
      })

      it("should emit a 'doc-active' event with the id", function (ctx) {
        ctx.RoomEvents.emit
          .calledWithExactly('doc-active', ctx.doc_id)
          .should.equal(true)
      })

      it("should listen for the 'doc-subscribed-id' event", function (ctx) {
        ctx.RoomEvents.once
          .calledWith(`doc-subscribed-${ctx.doc_id}`)
          .should.equal(true)
      })

      it('should join the room using the id', function (ctx) {
        ctx.client.join.calledWithExactly(ctx.doc_id).should.equal(true)
      })
    })

    describe('when there are other clients in the doc room', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.RoomManager._clientsInRoom
            .withArgs(ctx.client, ctx.doc_id)
            .onFirstCall()
            .returns(123)
            .onSecondCall()
            .returns(124)
          ctx.client.join = sinon.stub()
          ctx.RoomManager.joinDoc(ctx.client, ctx.doc_id, err => {
            if (err) return reject(err)
            resolve()
          })
        })
      })

      it('should join the room using the id', function (ctx) {
        ctx.client.join.called.should.equal(true)
      })

      it('should not emit any events', function (ctx) {
        ctx.RoomEvents.emit.called.should.equal(false)
      })
    })
  })

  describe('leaveDoc', function () {
    describe('when doc room will be empty after this client has left', function () {
      beforeEach(function (ctx) {
        ctx.RoomManager._clientAlreadyInRoom
          .withArgs(ctx.client, ctx.doc_id)
          .returns(true)
        ctx.RoomManager._clientsInRoom
          .withArgs(ctx.client, ctx.doc_id)
          .onCall(0)
          .returns(0)
        ctx.client.leave = sinon.stub()
        ctx.RoomManager.leaveDoc(ctx.client, ctx.doc_id)
      })

      it('should leave the room using the id', function (ctx) {
        ctx.client.leave.calledWithExactly(ctx.doc_id).should.equal(true)
      })

      it("should emit a 'doc-empty' event with the id", function (ctx) {
        ctx.RoomEvents.emit
          .calledWithExactly('doc-empty', ctx.doc_id)
          .should.equal(true)
      })
    })

    describe('when there are other clients in the doc room', function () {
      beforeEach(function (ctx) {
        ctx.RoomManager._clientAlreadyInRoom
          .withArgs(ctx.client, ctx.doc_id)
          .returns(true)
        ctx.RoomManager._clientsInRoom
          .withArgs(ctx.client, ctx.doc_id)
          .onCall(0)
          .returns(123)
        ctx.client.leave = sinon.stub()
        ctx.RoomManager.leaveDoc(ctx.client, ctx.doc_id)
      })

      it('should leave the room using the id', function (ctx) {
        ctx.client.leave.calledWithExactly(ctx.doc_id).should.equal(true)
      })

      it('should not emit any events', function (ctx) {
        ctx.RoomEvents.emit.called.should.equal(false)
      })
    })

    describe('when the client is not in the doc room', function () {
      beforeEach(function (ctx) {
        ctx.RoomManager._clientAlreadyInRoom
          .withArgs(ctx.client, ctx.doc_id)
          .returns(false)
        ctx.RoomManager._clientsInRoom
          .withArgs(ctx.client, ctx.doc_id)
          .onCall(0)
          .returns(0)
        ctx.client.leave = sinon.stub()
        ctx.RoomManager.leaveDoc(ctx.client, ctx.doc_id)
      })

      it('should not leave the room', function (ctx) {
        ctx.client.leave.called.should.equal(false)
      })

      it('should not emit any events', function (ctx) {
        ctx.RoomEvents.emit.called.should.equal(false)
      })
    })
  })

  describe('leaveProjectAndDocs', function () {
    describe('when the client is connected to the project and multiple docs', function () {
      beforeEach(function (ctx) {
        ctx.RoomManager._roomsClientIsIn = sinon
          .stub()
          .returns([ctx.project_id, ctx.doc_id, ctx.other_doc_id])
        ctx.client.join = sinon.stub()
        ctx.client.leave = sinon.stub()
      })

      describe('when this is the only client connected', function () {
        beforeEach(async function (ctx) {
          await new Promise((resolve, reject) => {
            // first call is for the join,
            // second for the leave
            ctx.RoomManager._clientsInRoom
              .withArgs(ctx.client, ctx.doc_id)
              .onCall(0)
              .returns(0)
              .onCall(1)
              .returns(0)
            ctx.RoomManager._clientsInRoom
              .withArgs(ctx.client, ctx.other_doc_id)
              .onCall(0)
              .returns(0)
              .onCall(1)
              .returns(0)
            ctx.RoomManager._clientsInRoom
              .withArgs(ctx.client, ctx.project_id)
              .onCall(0)
              .returns(0)
              .onCall(1)
              .returns(0)
            ctx.RoomManager._clientAlreadyInRoom
              .withArgs(ctx.client, ctx.doc_id)
              .returns(true)
              .withArgs(ctx.client, ctx.other_doc_id)
              .returns(true)
              .withArgs(ctx.client, ctx.project_id)
              .returns(true)
            ctx.RoomEvents.on('project-active', id => {
              setTimeout(() => {
                ctx.RoomEvents.emit(`project-subscribed-${id}`)
              }, 100)
            })
            ctx.RoomEvents.on('doc-active', id => {
              setTimeout(() => {
                ctx.RoomEvents.emit(`doc-subscribed-${id}`)
              }, 100)
            })
            // put the client in the rooms
            ctx.RoomManager.joinProject(ctx.client, ctx.project_id, () => {
              ctx.RoomManager.joinDoc(ctx.client, ctx.doc_id, () => {
                ctx.RoomManager.joinDoc(ctx.client, ctx.other_doc_id, () => {
                  // now leave the project
                  ctx.RoomManager.leaveProjectAndDocs(ctx.client)
                  resolve()
                })
              })
            })
          })
        })

        it('should leave all the docs', function (ctx) {
          ctx.client.leave.calledWithExactly(ctx.doc_id).should.equal(true)
          ctx.client.leave
            .calledWithExactly(ctx.other_doc_id)
            .should.equal(true)
        })

        it('should leave the project', function (ctx) {
          ctx.client.leave.calledWithExactly(ctx.project_id).should.equal(true)
        })

        it("should emit a 'doc-empty' event with the id for each doc", function (ctx) {
          ctx.RoomEvents.emit
            .calledWithExactly('doc-empty', ctx.doc_id)
            .should.equal(true)
          ctx.RoomEvents.emit
            .calledWithExactly('doc-empty', ctx.other_doc_id)
            .should.equal(true)
        })

        it("should emit a 'project-empty' event with the id for the project", function (ctx) {
          ctx.RoomEvents.emit
            .calledWithExactly('project-empty', ctx.project_id)
            .should.equal(true)
        })
      })

      describe('when other clients are still connected', function () {
        beforeEach(function (ctx) {
          ctx.RoomManager._clientsInRoom
            .withArgs(ctx.client, ctx.doc_id)
            .onFirstCall()
            .returns(123)
            .onSecondCall()
            .returns(122)
          ctx.RoomManager._clientsInRoom
            .withArgs(ctx.client, ctx.other_doc_id)
            .onFirstCall()
            .returns(123)
            .onSecondCall()
            .returns(122)
          ctx.RoomManager._clientsInRoom
            .withArgs(ctx.client, ctx.project_id)
            .onFirstCall()
            .returns(123)
            .onSecondCall()
            .returns(122)
          ctx.RoomManager._clientAlreadyInRoom
            .withArgs(ctx.client, ctx.doc_id)
            .returns(true)
            .withArgs(ctx.client, ctx.other_doc_id)
            .returns(true)
            .withArgs(ctx.client, ctx.project_id)
            .returns(true)
          ctx.RoomManager.leaveProjectAndDocs(ctx.client)
        })

        it('should leave all the docs', function (ctx) {
          ctx.client.leave.calledWithExactly(ctx.doc_id).should.equal(true)
          ctx.client.leave
            .calledWithExactly(ctx.other_doc_id)
            .should.equal(true)
        })

        it('should leave the project', function (ctx) {
          ctx.client.leave.calledWithExactly(ctx.project_id).should.equal(true)
        })

        it('should not emit any events', function (ctx) {
          ctx.RoomEvents.emit.called.should.equal(false)
        })
      })
    })
  })
})

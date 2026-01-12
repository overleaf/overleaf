import { vi, expect, describe, beforeEach, afterEach, it } from 'vitest'

/* eslint-disable
    no-return-assign,
    no-throw-literal,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
import sinon from 'sinon'
import tk from 'timekeeper'
import Errors from '../../../app/js/Errors.js'
const modulePath = '../../../app/js/WebsocketController.js'
const { UpdateTooLargeError } = Errors

describe('WebsocketController', function () {
  beforeEach(async function (ctx) {
    tk.freeze(new Date())
    ctx.project_id = 'project-id-123'
    ctx.user = {
      _id: (ctx.user_id = 'user-id-123'),
      first_name: 'James',
      last_name: 'Allen',
      email: 'james@example.com',
      signUpDate: new Date('2014-01-01'),
      loginCount: 42,
    }
    ctx.callback = sinon.stub()
    ctx.client = {
      disconnected: false,
      id: (ctx.client_id = 'mock-client-id-123'),
      publicId: `other-id-${Math.random()}`,
      ol_context: {},
      joinLeaveEpoch: 0,
      join: sinon.stub(),
      leave: sinon.stub(),
    }

    vi.doMock('../../../app/js/WebApiManager', () => ({
      default: (ctx.WebApiManager = {}),
    }))

    vi.doMock('../../../app/js/AuthorizationManager', () => ({
      default: (ctx.AuthorizationManager = {}),
    }))

    vi.doMock('../../../app/js/DocumentUpdaterManager', () => ({
      default: (ctx.DocumentUpdaterManager = {}),
    }))

    vi.doMock('../../../app/js/ConnectedUsersManager', () => ({
      default: (ctx.ConnectedUsersManager = {}),
    }))

    vi.doMock('../../../app/js/WebsocketLoadBalancer', () => ({
      default: (ctx.WebsocketLoadBalancer = {}),
    }))

    vi.doMock('@overleaf/metrics', () => ({
      default: (ctx.metrics = {
        inc: sinon.stub(),
        set: sinon.stub(),
      }),
    }))

    vi.doMock('../../../app/js/RoomManager', () => ({
      default: (ctx.RoomManager = {}),
    }))

    ctx.WebsocketController = (await import(modulePath)).default
  })

  afterEach(function () {
    return tk.reset()
  })

  describe('joinProject', function () {
    describe('when authorised', function () {
      beforeEach(function (ctx) {
        ctx.client.id = 'mock-client-id'
        ctx.project = {
          name: 'Test Project',
          owner: {
            _id: (ctx.owner_id = 'mock-owner-id-123'),
          },
        }
        ctx.privilegeLevel = 'owner'
        ctx.ConnectedUsersManager.updateUserPosition = sinon
          .stub()
          .callsArgAsync(4)
        ctx.isRestrictedUser = true
        ctx.isTokenMember = true
        ctx.isInvitedMember = true
        ctx.WebApiManager.joinProject = sinon
          .stub()
          .callsArgWith(2, null, ctx.project, ctx.privilegeLevel, {
            isRestrictedUser: ctx.isRestrictedUser,
            isTokenMember: ctx.isTokenMember,
            isInvitedMember: ctx.isInvitedMember,
          })
        ctx.RoomManager.joinProject = sinon.stub().callsArg(2)
        return ctx.WebsocketController.joinProject(
          ctx.client,
          ctx.user,
          ctx.project_id,
          ctx.callback
        )
      })

      it('should load the project from web', function (ctx) {
        return ctx.WebApiManager.joinProject
          .calledWith(ctx.project_id, ctx.user)
          .should.equal(true)
      })

      it('should join the project room', function (ctx) {
        return ctx.RoomManager.joinProject
          .calledWith(ctx.client, ctx.project_id)
          .should.equal(true)
      })

      it('should set the privilege level on the client', function (ctx) {
        return ctx.client.ol_context.privilege_level.should.equal(
          ctx.privilegeLevel
        )
      })
      it("should set the user's id on the client", function (ctx) {
        return ctx.client.ol_context.user_id.should.equal(ctx.user._id)
      })
      it("should set the user's email on the client", function (ctx) {
        return ctx.client.ol_context.email.should.equal(ctx.user.email)
      })
      it("should set the user's first_name on the client", function (ctx) {
        return ctx.client.ol_context.first_name.should.equal(
          ctx.user.first_name
        )
      })
      it("should set the user's last_name on the client", function (ctx) {
        return ctx.client.ol_context.last_name.should.equal(ctx.user.last_name)
      })
      it("should set the user's sign up date on the client", function (ctx) {
        return ctx.client.ol_context.signup_date.should.equal(
          ctx.user.signUpDate
        )
      })
      it("should set the user's login_count on the client", function (ctx) {
        return ctx.client.ol_context.login_count.should.equal(
          ctx.user.loginCount
        )
      })
      it('should set the connected time on the client', function (ctx) {
        return ctx.client.ol_context.connected_time.should.equal(new Date())
      })
      it('should set the project_id on the client', function (ctx) {
        return ctx.client.ol_context.project_id.should.equal(ctx.project_id)
      })
      it('should set the project owner id on the client', function (ctx) {
        return ctx.client.ol_context.owner_id.should.equal(ctx.owner_id)
      })
      it('should set the is_restricted_user flag on the client', function (ctx) {
        return ctx.client.ol_context.is_restricted_user.should.equal(
          ctx.isRestrictedUser
        )
      })
      it('should set the is_token_member flag on the client', function (ctx) {
        ctx.client.ol_context.is_token_member.should.equal(ctx.isTokenMember)
      })
      it('should set the is_invited_member flag on the client', function (ctx) {
        ctx.client.ol_context.is_invited_member.should.equal(
          ctx.isInvitedMember
        )
      })
      it('should call the callback with the project, privilegeLevel and protocolVersion', function (ctx) {
        return ctx.callback
          .calledWith(
            null,
            ctx.project,
            ctx.privilegeLevel,
            ctx.WebsocketController.PROTOCOL_VERSION
          )
          .should.equal(true)
      })

      it('should mark the user as connected in ConnectedUsersManager', function (ctx) {
        return ctx.ConnectedUsersManager.updateUserPosition
          .calledWith(ctx.project_id, ctx.client.publicId, ctx.user, null)
          .should.equal(true)
      })

      return it('should increment the join-project metric', function (ctx) {
        return ctx.metrics.inc
          .calledWith('editor.join-project')
          .should.equal(true)
      })
    })

    describe('when not authorized', function () {
      beforeEach(function (ctx) {
        ctx.WebApiManager.joinProject = sinon
          .stub()
          .callsArgWith(2, null, null, null)
        return ctx.WebsocketController.joinProject(
          ctx.client,
          ctx.user,
          ctx.project_id,
          ctx.callback
        )
      })

      it('should return an error', function (ctx) {
        return ctx.callback
          .calledWith(sinon.match({ message: 'not authorized' }))
          .should.equal(true)
      })

      return it('should not log an error', function (ctx) {
        return ctx.logger.error.called.should.equal(false)
      })
    })

    describe('when the subscribe failed', function () {
      beforeEach(function (ctx) {
        ctx.client.id = 'mock-client-id'
        ctx.project = {
          name: 'Test Project',
          owner: {
            _id: (ctx.owner_id = 'mock-owner-id-123'),
          },
        }
        ctx.privilegeLevel = 'owner'
        ctx.ConnectedUsersManager.updateUserPosition = sinon
          .stub()
          .callsArgAsync(4)
        ctx.isRestrictedUser = true
        ctx.isTokenMember = true
        ctx.isInvitedMember = true
        ctx.WebApiManager.joinProject = sinon
          .stub()
          .callsArgWith(2, null, ctx.project, ctx.privilegeLevel, {
            isRestrictedUser: ctx.isRestrictedUser,
            isTokenMember: ctx.isTokenMember,
            isInvitedMember: ctx.isInvitedMember,
          })
        ctx.RoomManager.joinProject = sinon
          .stub()
          .callsArgWith(2, new Error('subscribe failed'))
        return ctx.WebsocketController.joinProject(
          ctx.client,
          ctx.user,
          ctx.project_id,
          ctx.callback
        )
      })

      return it('should return an error', function (ctx) {
        ctx.callback
          .calledWith(sinon.match({ message: 'subscribe failed' }))
          .should.equal(true)
        return ctx.callback.args[0][0].message.should.equal('subscribe failed')
      })
    })

    describe('when the client has disconnected', function () {
      beforeEach(function (ctx) {
        ctx.client.disconnected = true
        ctx.WebApiManager.joinProject = sinon.stub().callsArg(2)
        return ctx.WebsocketController.joinProject(
          ctx.client,
          ctx.user,
          ctx.project_id,
          ctx.callback
        )
      })

      it('should not call WebApiManager.joinProject', function (ctx) {
        return expect(ctx.WebApiManager.joinProject.called).to.equal(false)
      })

      it('should call the callback with no details', function (ctx) {
        return expect(ctx.callback.args[0]).to.deep.equal([])
      })

      return it('should increment the editor.join-project.disconnected metric with a status', function (ctx) {
        return expect(
          ctx.metrics.inc.calledWith('editor.join-project.disconnected', 1, {
            status: 'immediately',
          })
        ).to.equal(true)
      })
    })

    return describe('when the client disconnects while WebApiManager.joinProject is running', function () {
      beforeEach(function (ctx) {
        ctx.WebApiManager.joinProject = (project, user, cb) => {
          ctx.client.disconnected = true
          return cb(null, ctx.project, ctx.privilegeLevel, {
            isRestrictedUser: ctx.isRestrictedUser,
            isTokenMember: ctx.isTokenMember,
            isInvitedMember: ctx.isInvitedMember,
          })
        }

        return ctx.WebsocketController.joinProject(
          ctx.client,
          ctx.user,
          ctx.project_id,
          ctx.callback
        )
      })

      it('should call the callback with no details', function (ctx) {
        return expect(ctx.callback.args[0]).to.deep.equal([])
      })

      return it('should increment the editor.join-project.disconnected metric with a status', function (ctx) {
        return expect(
          ctx.metrics.inc.calledWith('editor.join-project.disconnected', 1, {
            status: 'after-web-api-call',
          })
        ).to.equal(true)
      })
    })
  })

  describe('leaveProject', function () {
    beforeEach(function (ctx) {
      ctx.DocumentUpdaterManager.flushProjectToMongoAndDelete = sinon
        .stub()
        .callsArg(1)
      ctx.ConnectedUsersManager.markUserAsDisconnected = sinon
        .stub()
        .callsArg(2)
      ctx.WebsocketLoadBalancer.emitToRoom = sinon.stub()
      ctx.RoomManager.leaveProjectAndDocs = sinon.stub()
      ctx.clientsInRoom = []
      ctx.io = {
        sockets: {
          clients: roomId => {
            if (roomId !== ctx.project_id) {
              throw 'expected room_id to be project_id'
            }
            return ctx.clientsInRoom
          },
        },
      }
      ctx.client.ol_context.project_id = ctx.project_id
      ctx.client.ol_context.user_id = ctx.user_id
      ctx.WebsocketController.FLUSH_IF_EMPTY_DELAY = 0
      tk.reset()
    }) // Allow setTimeout to work.

    describe('when the client did not joined a project yet', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.client.ol_context = {}
          ctx.WebsocketController.leaveProject(ctx.io, ctx.client, err => {
            if (err) return reject(err)
            resolve()
          })
        })
      })

      it('should bail out when calling leaveProject', function (ctx) {
        ctx.WebsocketLoadBalancer.emitToRoom.called.should.equal(false)
        ctx.RoomManager.leaveProjectAndDocs.called.should.equal(false)
        ctx.ConnectedUsersManager.markUserAsDisconnected.called.should.equal(
          false
        )
      })

      it('should not inc any metric', function (ctx) {
        ctx.metrics.inc.called.should.equal(false)
      })
    })

    describe('when the project is empty', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.clientsInRoom = []
          ctx.WebsocketController.leaveProject(ctx.io, ctx.client, err => {
            if (err) return reject(err)
            resolve()
          })
        })
      })

      it('should end clientTracking.clientDisconnected to the project room', function (ctx) {
        ctx.WebsocketLoadBalancer.emitToRoom
          .calledWith(
            ctx.project_id,
            'clientTracking.clientDisconnected',
            ctx.client.publicId
          )
          .should.equal(true)
      })

      it('should mark the user as disconnected', function (ctx) {
        ctx.ConnectedUsersManager.markUserAsDisconnected
          .calledWith(ctx.project_id, ctx.client.publicId)
          .should.equal(true)
      })

      it('should flush the project in the document updater', function (ctx) {
        ctx.DocumentUpdaterManager.flushProjectToMongoAndDelete
          .calledWith(ctx.project_id)
          .should.equal(true)
      })

      it('should increment the leave-project metric', function (ctx) {
        ctx.metrics.inc.calledWith('editor.leave-project').should.equal(true)
      })

      it('should track the disconnection in RoomManager', function (ctx) {
        ctx.RoomManager.leaveProjectAndDocs
          .calledWith(ctx.client)
          .should.equal(true)
      })
    })

    describe('when the project is not empty', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.clientsInRoom = ['mock-remaining-client']
          ctx.io = {
            sockets: {
              clients: roomId => {
                if (roomId !== ctx.project_id) {
                  throw 'expected room_id to be project_id'
                }
                return ctx.clientsInRoom
              },
            },
          }
          ctx.WebsocketController.leaveProject(ctx.io, ctx.client, err => {
            if (err) return reject(err)
            resolve()
          })
        })
      })

      it('should not flush the project in the document updater', function (ctx) {
        ctx.DocumentUpdaterManager.flushProjectToMongoAndDelete.called.should.equal(
          false
        )
      })
    })

    describe('when client has not authenticated', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.client.ol_context.user_id = null
          ctx.client.ol_context.project_id = null
          ctx.WebsocketController.leaveProject(ctx.io, ctx.client, err => {
            if (err) return reject(err)
            resolve()
          })
        })
      })

      it('should not end clientTracking.clientDisconnected to the project room', function (ctx) {
        ctx.WebsocketLoadBalancer.emitToRoom
          .calledWith(
            ctx.project_id,
            'clientTracking.clientDisconnected',
            ctx.client.publicId
          )
          .should.equal(false)
      })

      it('should not mark the user as disconnected', function (ctx) {
        ctx.ConnectedUsersManager.markUserAsDisconnected
          .calledWith(ctx.project_id, ctx.client.publicId)
          .should.equal(false)
      })

      it('should not flush the project in the document updater', function (ctx) {
        ctx.DocumentUpdaterManager.flushProjectToMongoAndDelete
          .calledWith(ctx.project_id)
          .should.equal(false)
      })

      it('should not increment the leave-project metric', function (ctx) {
        ctx.metrics.inc.calledWith('editor.leave-project').should.equal(false)
      })
    })

    describe('when client has not joined a project', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.client.ol_context.user_id = ctx.user_id
          ctx.client.ol_context.project_id = null
          ctx.WebsocketController.leaveProject(ctx.io, ctx.client, err => {
            if (err) return reject(err)
            resolve()
          })
        })
      })

      it('should not end clientTracking.clientDisconnected to the project room', function (ctx) {
        ctx.WebsocketLoadBalancer.emitToRoom
          .calledWith(
            ctx.project_id,
            'clientTracking.clientDisconnected',
            ctx.client.publicId
          )
          .should.equal(false)
      })

      it('should not mark the user as disconnected', function (ctx) {
        ctx.ConnectedUsersManager.markUserAsDisconnected
          .calledWith(ctx.project_id, ctx.client.publicId)
          .should.equal(false)
      })

      it('should not flush the project in the document updater', function (ctx) {
        ctx.DocumentUpdaterManager.flushProjectToMongoAndDelete
          .calledWith(ctx.project_id)
          .should.equal(false)
      })

      it('should not increment the leave-project metric', function (ctx) {
        ctx.metrics.inc.calledWith('editor.leave-project').should.equal(false)
      })
    })
  })

  describe('joinDoc', function () {
    beforeEach(function (ctx) {
      ctx.doc_id = 'doc-id-123'
      ctx.doc_lines = ['doc', 'lines']
      ctx.version = 42
      ctx.ops = ['mock', 'ops']
      ctx.ranges = { mock: 'ranges' }
      ctx.options = {}

      ctx.client.ol_context.project_id = ctx.project_id
      ctx.client.ol_context.is_restricted_user = false
      ctx.AuthorizationManager.addAccessToDoc = sinon.stub().yields()
      ctx.AuthorizationManager.assertClientCanViewProject = sinon
        .stub()
        .callsArgWith(1, null)
      ctx.AuthorizationManager.assertClientCanViewProjectAndDoc = sinon
        .stub()
        .callsArgWith(2, null)
      ctx.DocumentUpdaterManager.getDocument = sinon
        .stub()
        .callsArgWith(3, null, ctx.doc_lines, ctx.version, ctx.ranges, ctx.ops)
      ctx.RoomManager.joinDoc = sinon.stub().callsArg(2)
    })

    describe('works', function () {
      beforeEach(function (ctx) {
        ctx.WebsocketController.joinDoc(
          ctx.client,
          ctx.doc_id,
          -1,
          ctx.options,
          ctx.callback
        )
      })

      it('should inc the joinLeaveEpoch', function (ctx) {
        expect(ctx.client.joinLeaveEpoch).to.equal(1)
      })

      it('should check that the client is authorized to view the project', function (ctx) {
        ctx.AuthorizationManager.assertClientCanViewProject
          .calledWith(ctx.client)
          .should.equal(true)
      })

      it('should get the document from the DocumentUpdaterManager with fromVersion', function (ctx) {
        ctx.DocumentUpdaterManager.getDocument
          .calledWith(ctx.project_id, ctx.doc_id, -1)
          .should.equal(true)
      })

      it('should add permissions for the client to access the doc', function (ctx) {
        ctx.AuthorizationManager.addAccessToDoc
          .calledWith(ctx.client, ctx.doc_id)
          .should.equal(true)
      })

      it('should join the client to room for the doc_id', function (ctx) {
        ctx.RoomManager.joinDoc
          .calledWith(ctx.client, ctx.doc_id)
          .should.equal(true)
      })

      it('should call the callback with the lines, version, ranges and ops', function (ctx) {
        ctx.callback
          .calledWith(null, ctx.doc_lines, ctx.version, ctx.ops, ctx.ranges)
          .should.equal(true)
      })

      it('should increment the join-doc metric', function (ctx) {
        ctx.metrics.inc.calledWith('editor.join-doc').should.equal(true)
      })
    })

    describe('with a fromVersion', function () {
      beforeEach(function (ctx) {
        ctx.fromVersion = 40
        ctx.WebsocketController.joinDoc(
          ctx.client,
          ctx.doc_id,
          ctx.fromVersion,
          ctx.options,
          ctx.callback
        )
      })

      it('should get the document from the DocumentUpdaterManager with fromVersion', function (ctx) {
        ctx.DocumentUpdaterManager.getDocument
          .calledWith(ctx.project_id, ctx.doc_id, ctx.fromVersion)
          .should.equal(true)
      })
    })

    describe('with doclines that need escaping', function () {
      beforeEach(function (ctx) {
        ctx.doc_lines.push(['räksmörgås'])
        ctx.WebsocketController.joinDoc(
          ctx.client,
          ctx.doc_id,
          -1,
          ctx.options,
          ctx.callback
        )
      })

      it('should call the callback with the escaped lines', function (ctx) {
        const escapedLines = ctx.callback.args[0][1]
        const escapedWord = escapedLines.pop()
        escapedWord.should.equal('rÃ¤ksmÃ¶rgÃ¥s')
        // Check that unescaping works
        decodeURIComponent(escape(escapedWord)).should.equal('räksmörgås')
      })
    })

    describe('with comments that need encoding', function () {
      beforeEach(function (ctx) {
        ctx.ranges.comments = [{ op: { c: 'räksmörgås' } }]
        ctx.WebsocketController.joinDoc(
          ctx.client,
          ctx.doc_id,
          -1,
          { encodeRanges: true },
          ctx.callback
        )
      })

      it('should call the callback with the encoded comment', function (ctx) {
        const encodedComments = ctx.callback.args[0][4]
        const encodedComment = encodedComments.comments.pop()
        const encodedCommentText = encodedComment.op.c
        encodedCommentText.should.equal('rÃ¤ksmÃ¶rgÃ¥s')
      })
    })

    describe('with changes that need encoding', function () {
      it('should call the callback with the encoded insert change', function (ctx) {
        ctx.ranges.changes = [{ op: { i: 'räksmörgås' } }]
        ctx.WebsocketController.joinDoc(
          ctx.client,
          ctx.doc_id,
          -1,
          { encodeRanges: true },
          ctx.callback
        )

        const encodedChanges = ctx.callback.args[0][4]
        const encodedChange = encodedChanges.changes.pop()
        const encodedChangeText = encodedChange.op.i
        encodedChangeText.should.equal('rÃ¤ksmÃ¶rgÃ¥s')
      })

      it('should call the callback with the encoded delete change', function (ctx) {
        ctx.ranges.changes = [{ op: { d: 'räksmörgås' } }]
        ctx.WebsocketController.joinDoc(
          ctx.client,
          ctx.doc_id,
          -1,
          { encodeRanges: true },
          ctx.callback
        )

        const encodedChanges = ctx.callback.args[0][4]
        const encodedChange = encodedChanges.changes.pop()
        const encodedChangeText = encodedChange.op.d
        encodedChangeText.should.equal('rÃ¤ksmÃ¶rgÃ¥s')
      })
    })

    describe('when not authorized', function () {
      beforeEach(function (ctx) {
        ctx.AuthorizationManager.assertClientCanViewProject = sinon
          .stub()
          .callsArgWith(1, (ctx.err = new Error('not authorized')))
        ctx.WebsocketController.joinDoc(
          ctx.client,
          ctx.doc_id,
          -1,
          ctx.options,
          ctx.callback
        )
      })

      it('should call the callback with an error', function (ctx) {
        ctx.callback
          .calledWith(sinon.match({ message: 'not authorized' }))
          .should.equal(true)
      })

      it('should not call the DocumentUpdaterManager', function (ctx) {
        ctx.DocumentUpdaterManager.getDocument.called.should.equal(false)
      })
    })

    describe('with a restricted client', function () {
      beforeEach(function (ctx) {
        ctx.ranges.comments = [{ op: { a: 1 } }, { op: { a: 2 } }]
        ctx.client.ol_context.is_restricted_user = true
        ctx.WebsocketController.joinDoc(
          ctx.client,
          ctx.doc_id,
          -1,
          ctx.options,
          ctx.callback
        )
      })

      it('should overwrite ranges.comments with an empty list', function (ctx) {
        const ranges = ctx.callback.args[0][4]
        expect(ranges.comments).to.deep.equal([])
      })
    })

    describe('when the client has disconnected', function () {
      beforeEach(function (ctx) {
        ctx.client.disconnected = true
        ctx.WebsocketController.joinDoc(
          ctx.client,
          ctx.doc_id,
          -1,
          ctx.options,
          ctx.callback
        )
      })

      it('should call the callback with no details', function (ctx) {
        expect(ctx.callback.args[0]).to.deep.equal([])
      })

      it('should increment the editor.join-doc.disconnected metric with a status', function (ctx) {
        expect(
          ctx.metrics.inc.calledWith('editor.join-doc.disconnected', 1, {
            status: 'immediately',
          })
        ).to.equal(true)
      })

      it('should not get the document', function (ctx) {
        expect(ctx.DocumentUpdaterManager.getDocument.called).to.equal(false)
      })
    })

    describe('when the client disconnects while auth checks are running', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(
            new Error()
          )
          ctx.DocumentUpdaterManager.checkDocument = (projectId, docId, cb) => {
            ctx.client.disconnected = true
            cb()
          }

          ctx.WebsocketController.joinDoc(
            ctx.client,
            ctx.doc_id,
            -1,
            ctx.options,
            (...args) => {
              ctx.callback(...args)
              resolve()
            }
          )
        })
      })

      it('should call the callback with no details', function (ctx) {
        expect(ctx.callback.called).to.equal(true)
        expect(ctx.callback.args[0]).to.deep.equal([])
      })

      it('should increment the editor.join-doc.disconnected metric with a status', function (ctx) {
        expect(
          ctx.metrics.inc.calledWith('editor.join-doc.disconnected', 1, {
            status: 'after-client-auth-check',
          })
        ).to.equal(true)
      })

      it('should not get the document', function (ctx) {
        expect(ctx.DocumentUpdaterManager.getDocument.called).to.equal(false)
      })
    })

    describe('when the client starts a parallel joinDoc request', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(
            new Error()
          )
          ctx.DocumentUpdaterManager.checkDocument = (projectId, docId, cb) => {
            ctx.DocumentUpdaterManager.checkDocument = sinon.stub().yields()
            ctx.WebsocketController.joinDoc(
              ctx.client,
              ctx.doc_id,
              -1,
              {},
              () => {}
            )
            cb()
          }

          ctx.WebsocketController.joinDoc(
            ctx.client,
            ctx.doc_id,
            -1,
            ctx.options,
            (...args) => {
              ctx.callback(...args)
              // make sure the other joinDoc request completed
              setTimeout(resolve, 5)
            }
          )
        })
      })

      it('should call the callback with an error', function (ctx) {
        expect(ctx.callback.called).to.equal(true)
        expect(ctx.callback.args[0][0].message).to.equal(
          'joinLeaveEpoch mismatch'
        )
      })

      it('should get the document once (the parallel request wins)', function (ctx) {
        expect(ctx.DocumentUpdaterManager.getDocument.callCount).to.equal(1)
      })
    })

    describe('when the client starts a parallel leaveDoc request', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.RoomManager.leaveDoc = sinon.stub()

          ctx.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(
            new Error()
          )
          ctx.DocumentUpdaterManager.checkDocument = (projectId, docId, cb) => {
            ctx.WebsocketController.leaveDoc(ctx.client, ctx.doc_id, () => {})
            cb()
          }

          ctx.WebsocketController.joinDoc(
            ctx.client,
            ctx.doc_id,
            -1,
            ctx.options,
            (...args) => {
              ctx.callback(...args)
              resolve()
            }
          )
        })
      })

      it('should call the callback with an error', function (ctx) {
        expect(ctx.callback.called).to.equal(true)
        expect(ctx.callback.args[0][0].message).to.equal(
          'joinLeaveEpoch mismatch'
        )
      })

      it('should not get the document', function (ctx) {
        expect(ctx.DocumentUpdaterManager.getDocument.called).to.equal(false)
      })
    })

    describe('when the client disconnects while RoomManager.joinDoc is running', function () {
      beforeEach(function (ctx) {
        ctx.RoomManager.joinDoc = (client, docId, cb) => {
          ctx.client.disconnected = true
          cb()
        }

        ctx.WebsocketController.joinDoc(
          ctx.client,
          ctx.doc_id,
          -1,
          ctx.options,
          ctx.callback
        )
      })

      it('should call the callback with no details', function (ctx) {
        expect(ctx.callback.args[0]).to.deep.equal([])
      })

      it('should increment the editor.join-doc.disconnected metric with a status', function (ctx) {
        expect(
          ctx.metrics.inc.calledWith('editor.join-doc.disconnected', 1, {
            status: 'after-joining-room',
          })
        ).to.equal(true)
      })

      it('should not get the document', function (ctx) {
        expect(ctx.DocumentUpdaterManager.getDocument.called).to.equal(false)
      })
    })

    describe('when the client disconnects while DocumentUpdaterManager.getDocument is running', function () {
      beforeEach(function (ctx) {
        ctx.DocumentUpdaterManager.getDocument = (
          projectId,
          docId,
          fromVersion,
          callback
        ) => {
          ctx.client.disconnected = true
          callback(null, ctx.doc_lines, ctx.version, ctx.ranges, ctx.ops)
        }

        ctx.WebsocketController.joinDoc(
          ctx.client,
          ctx.doc_id,
          -1,
          ctx.options,
          ctx.callback
        )
      })

      it('should call the callback with no details', function (ctx) {
        expect(ctx.callback.args[0]).to.deep.equal([])
      })

      it('should increment the editor.join-doc.disconnected metric with a status', function (ctx) {
        expect(
          ctx.metrics.inc.calledWith('editor.join-doc.disconnected', 1, {
            status: 'after-doc-updater-call',
          })
        ).to.equal(true)
      })
    })
  })

  describe('leaveDoc', function () {
    beforeEach(function (ctx) {
      ctx.doc_id = 'doc-id-123'
      ctx.client.ol_context.project_id = ctx.project_id
      ctx.RoomManager.leaveDoc = sinon.stub()
      ctx.WebsocketController.leaveDoc(ctx.client, ctx.doc_id, ctx.callback)
    })

    it('should inc the joinLeaveEpoch', function (ctx) {
      expect(ctx.client.joinLeaveEpoch).to.equal(1)
    })

    it('should remove the client from the doc_id room', function (ctx) {
      ctx.RoomManager.leaveDoc
        .calledWith(ctx.client, ctx.doc_id)
        .should.equal(true)
    })

    it('should call the callback', function (ctx) {
      ctx.callback.called.should.equal(true)
    })

    it('should increment the leave-doc metric', function (ctx) {
      ctx.metrics.inc.calledWith('editor.leave-doc').should.equal(true)
    })
  })

  describe('getConnectedUsers', function () {
    beforeEach(function (ctx) {
      ctx.client.ol_context.project_id = ctx.project_id
      ctx.users = ['mock', 'users']
      ctx.WebsocketLoadBalancer.emitToRoom = sinon.stub()
      ctx.ConnectedUsersManager.getConnectedUsers = sinon
        .stub()
        .callsArgWith(1, null, ctx.users)
    })

    describe('when authorized', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.AuthorizationManager.assertClientCanViewProject = sinon
            .stub()
            .callsArgWith(1, null)
          ctx.WebsocketController.getConnectedUsers(ctx.client, (...args) => {
            ctx.callback(...Array.from(args || []))
            resolve()
          })
        })
      })

      it('should check that the client is authorized to view the project', function (ctx) {
        ctx.AuthorizationManager.assertClientCanViewProject
          .calledWith(ctx.client)
          .should.equal(true)
      })

      it('should broadcast a request to update the client list', function (ctx) {
        ctx.WebsocketLoadBalancer.emitToRoom
          .calledWith(ctx.project_id, 'clientTracking.refresh')
          .should.equal(true)
      })

      it('should get the connected users for the project', function (ctx) {
        ctx.ConnectedUsersManager.getConnectedUsers
          .calledWith(ctx.project_id)
          .should.equal(true)
      })

      it('should  the users', function (ctx) {
        ctx.callback.calledWith(null, ctx.users).should.equal(true)
      })

      it('should increment the get-connected-users metric', function (ctx) {
        ctx.metrics.inc
          .calledWith('editor.get-connected-users')
          .should.equal(true)
      })
    })

    describe('when not authorized', function () {
      beforeEach(function (ctx) {
        ctx.AuthorizationManager.assertClientCanViewProject = sinon
          .stub()
          .callsArgWith(1, (ctx.err = new Error('not authorized')))
        ctx.WebsocketController.getConnectedUsers(ctx.client, ctx.callback)
      })

      it('should not get the connected users for the project', function (ctx) {
        ctx.ConnectedUsersManager.getConnectedUsers.called.should.equal(false)
      })

      it('should return an error', function (ctx) {
        ctx.callback.calledWith(ctx.err).should.equal(true)
      })
    })

    describe('when restricted user', function () {
      beforeEach(function (ctx) {
        ctx.client.ol_context.is_restricted_user = true
        ctx.AuthorizationManager.assertClientCanViewProject = sinon
          .stub()
          .callsArgWith(1, null)
        ctx.WebsocketController.getConnectedUsers(ctx.client, ctx.callback)
      })

      it('should return an empty array of users', function (ctx) {
        ctx.callback.calledWith(null, []).should.equal(true)
      })

      it('should not get the connected users for the project', function (ctx) {
        ctx.ConnectedUsersManager.getConnectedUsers.called.should.equal(false)
      })
    })

    describe('when the client has disconnected', function () {
      beforeEach(function (ctx) {
        ctx.client.disconnected = true
        ctx.AuthorizationManager.assertClientCanViewProject = sinon.stub()
        ctx.WebsocketController.getConnectedUsers(ctx.client, ctx.callback)
      })

      it('should call the callback with no details', function (ctx) {
        expect(ctx.callback.args[0]).to.deep.equal([])
      })

      it('should not check permissions', function (ctx) {
        expect(
          ctx.AuthorizationManager.assertClientCanViewProject.called
        ).to.equal(false)
      })
    })
  })

  describe('updateClientPosition', function () {
    beforeEach(function (ctx) {
      ctx.WebsocketLoadBalancer.emitToRoom = sinon.stub()
      ctx.ConnectedUsersManager.updateUserPosition = sinon
        .stub()
        .callsArgAsync(4)
      ctx.AuthorizationManager.assertClientCanViewProjectAndDoc = sinon
        .stub()
        .callsArgWith(2, null)
      ctx.update = {
        doc_id: (ctx.doc_id = 'doc-id-123'),
        row: (ctx.row = 42),
        column: (ctx.column = 37),
      }
    })

    describe('with a logged in user', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.client.ol_context = {
            project_id: ctx.project_id,
            first_name: (ctx.first_name = 'Douglas'),
            last_name: (ctx.last_name = 'Adams'),
            email: (ctx.email = 'joe@example.com'),
            user_id: (ctx.user_id = 'user-id-123'),
          }

          ctx.populatedCursorData = {
            doc_id: ctx.doc_id,
            id: ctx.client.publicId,
            name: `${ctx.first_name} ${ctx.last_name}`,
            row: ctx.row,
            column: ctx.column,
            email: ctx.email,
            user_id: ctx.user_id,
          }
          ctx.WebsocketController.updateClientPosition(
            ctx.client,
            ctx.update,
            err => {
              if (err) return reject(err)
              resolve()
            }
          )
        })
      })

      it("should send the update to the project room with the user's name", function (ctx) {
        ctx.WebsocketLoadBalancer.emitToRoom
          .calledWith(
            ctx.project_id,
            'clientTracking.clientUpdated',
            ctx.populatedCursorData
          )
          .should.equal(true)
      })

      it('should send the  cursor data to the connected user manager', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.ConnectedUsersManager.updateUserPosition
            .calledWith(
              ctx.project_id,
              ctx.client.publicId,
              {
                _id: ctx.user_id,
                email: ctx.email,
                first_name: ctx.first_name,
                last_name: ctx.last_name,
              },
              {
                row: ctx.row,
                column: ctx.column,
                doc_id: ctx.doc_id,
              }
            )
            .should.equal(true)
          resolve()
        })
      })

      it('should increment the update-client-position metric at 0.1 frequency', function (ctx) {
        ctx.metrics.inc
          .calledWith('editor.update-client-position', 0.1)
          .should.equal(true)
      })
    })

    describe('with a logged in user who has no last_name set', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.client.ol_context = {
            project_id: ctx.project_id,
            first_name: (ctx.first_name = 'Douglas'),
            last_name: undefined,
            email: (ctx.email = 'joe@example.com'),
            user_id: (ctx.user_id = 'user-id-123'),
          }

          ctx.populatedCursorData = {
            doc_id: ctx.doc_id,
            id: ctx.client.publicId,
            name: `${ctx.first_name}`,
            row: ctx.row,
            column: ctx.column,
            email: ctx.email,
            user_id: ctx.user_id,
          }
          ctx.WebsocketController.updateClientPosition(
            ctx.client,
            ctx.update,
            err => {
              if (err) return reject(err)
              resolve()
            }
          )
        })
      })

      it("should send the update to the project room with the user's name", function (ctx) {
        ctx.WebsocketLoadBalancer.emitToRoom
          .calledWith(
            ctx.project_id,
            'clientTracking.clientUpdated',
            ctx.populatedCursorData
          )
          .should.equal(true)
      })

      it('should send the  cursor data to the connected user manager', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.ConnectedUsersManager.updateUserPosition
            .calledWith(
              ctx.project_id,
              ctx.client.publicId,
              {
                _id: ctx.user_id,
                email: ctx.email,
                first_name: ctx.first_name,
                last_name: undefined,
              },
              {
                row: ctx.row,
                column: ctx.column,
                doc_id: ctx.doc_id,
              }
            )
            .should.equal(true)
          resolve()
        })
      })

      it('should increment the update-client-position metric at 0.1 frequency', function (ctx) {
        ctx.metrics.inc
          .calledWith('editor.update-client-position', 0.1)
          .should.equal(true)
      })
    })

    describe('with a logged in user who has no first_name set', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.client.ol_context = {
            project_id: ctx.project_id,
            first_name: undefined,
            last_name: (ctx.last_name = 'Adams'),
            email: (ctx.email = 'joe@example.com'),
            user_id: (ctx.user_id = 'user-id-123'),
          }

          ctx.populatedCursorData = {
            doc_id: ctx.doc_id,
            id: ctx.client.publicId,
            name: `${ctx.last_name}`,
            row: ctx.row,
            column: ctx.column,
            email: ctx.email,
            user_id: ctx.user_id,
          }
          ctx.WebsocketController.updateClientPosition(
            ctx.client,
            ctx.update,
            err => {
              if (err) return reject(err)
              resolve()
            }
          )
        })
      })

      it("should send the update to the project room with the user's name", function (ctx) {
        ctx.WebsocketLoadBalancer.emitToRoom
          .calledWith(
            ctx.project_id,
            'clientTracking.clientUpdated',
            ctx.populatedCursorData
          )
          .should.equal(true)
      })

      it('should send the  cursor data to the connected user manager', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.ConnectedUsersManager.updateUserPosition
            .calledWith(
              ctx.project_id,
              ctx.client.publicId,
              {
                _id: ctx.user_id,
                email: ctx.email,
                first_name: undefined,
                last_name: ctx.last_name,
              },
              {
                row: ctx.row,
                column: ctx.column,
                doc_id: ctx.doc_id,
              }
            )
            .should.equal(true)
          resolve()
        })
      })

      it('should increment the update-client-position metric at 0.1 frequency', function (ctx) {
        ctx.metrics.inc
          .calledWith('editor.update-client-position', 0.1)
          .should.equal(true)
      })
    })
    describe('with a logged in user who has no names set', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.client.ol_context = {
            project_id: ctx.project_id,
            first_name: undefined,
            last_name: undefined,
            email: (ctx.email = 'joe@example.com'),
            user_id: (ctx.user_id = 'user-id-123'),
          }
          ctx.WebsocketController.updateClientPosition(
            ctx.client,
            ctx.update,
            err => {
              if (err) return reject(err)
              resolve()
            }
          )
        })
      })

      it('should send the update to the project name with no name', function (ctx) {
        ctx.WebsocketLoadBalancer.emitToRoom
          .calledWith(ctx.project_id, 'clientTracking.clientUpdated', {
            doc_id: ctx.doc_id,
            id: ctx.client.publicId,
            user_id: ctx.user_id,
            name: '',
            row: ctx.row,
            column: ctx.column,
            email: ctx.email,
          })
          .should.equal(true)
      })
    })

    describe('with an anonymous user', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.client.ol_context = {
            project_id: ctx.project_id,
          }
          ctx.WebsocketController.updateClientPosition(
            ctx.client,
            ctx.update,
            err => {
              if (err) return reject(err)
              resolve()
            }
          )
        })
      })

      it('should send the update to the project room with no name', function (ctx) {
        ctx.WebsocketLoadBalancer.emitToRoom
          .calledWith(ctx.project_id, 'clientTracking.clientUpdated', {
            doc_id: ctx.doc_id,
            id: ctx.client.publicId,
            name: '',
            row: ctx.row,
            column: ctx.column,
          })
          .should.equal(true)
      })

      it('should not send cursor data to the connected user manager', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.ConnectedUsersManager.updateUserPosition.called.should.equal(
            false
          )
          resolve()
        })
      })
    })

    describe('when the client has disconnected', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.client.disconnected = true
          ctx.AuthorizationManager.assertClientCanViewProjectAndDoc =
            sinon.stub()
          ctx.WebsocketController.updateClientPosition(
            ctx.client,
            ctx.update,
            (...args) => {
              ctx.callback(...args)
              if (args[0]) return reject(args[0])
              resolve()
            }
          )
        })
      })

      it('should call the callback with no details', function (ctx) {
        expect(ctx.callback.args[0]).to.deep.equal([])
      })

      it('should not check permissions', function (ctx) {
        expect(
          ctx.AuthorizationManager.assertClientCanViewProjectAndDoc.called
        ).to.equal(false)
      })
    })
  })

  describe('applyOtUpdate', function () {
    beforeEach(function (ctx) {
      ctx.update = { op: { p: 12, t: 'foo' } }
      ctx.client.ol_context.user_id = ctx.user_id
      ctx.client.ol_context.project_id = ctx.project_id
      ctx.WebsocketController._assertClientCanApplyUpdate = sinon
        .stub()
        .yields()
      ctx.DocumentUpdaterManager.queueChange = sinon.stub().callsArg(3)
    })

    describe('succesfully', function () {
      beforeEach(function (ctx) {
        ctx.WebsocketController.applyOtUpdate(
          ctx.client,
          ctx.doc_id,
          ctx.update,
          ctx.callback
        )
      })

      it('should set the source of the update to the client id', function (ctx) {
        ctx.update.meta.source.should.equal(ctx.client.publicId)
      })

      it('should set the user_id of the update to the user id', function (ctx) {
        ctx.update.meta.user_id.should.equal(ctx.user_id)
      })

      it('should queue the update', function (ctx) {
        ctx.DocumentUpdaterManager.queueChange
          .calledWith(ctx.project_id, ctx.doc_id, ctx.update)
          .should.equal(true)
      })

      it('should call the callback', function (ctx) {
        ctx.callback.called.should.equal(true)
      })

      it('should increment the doc updates', function (ctx) {
        ctx.metrics.inc.calledWith('editor.doc-update').should.equal(true)
      })
    })

    describe('unsuccessfully', function () {
      beforeEach(function (ctx) {
        ctx.client.disconnect = sinon.stub()
        ctx.DocumentUpdaterManager.queueChange = sinon
          .stub()
          .callsArgWith(3, (ctx.error = new Error('Something went wrong')))
        ctx.WebsocketController.applyOtUpdate(
          ctx.client,
          ctx.doc_id,
          ctx.update,
          ctx.callback
        )
      })

      it('should disconnect the client', function (ctx) {
        ctx.client.disconnect.called.should.equal(true)
      })

      it('should not log an error', function (ctx) {
        ctx.logger.error.called.should.equal(false)
      })

      it('should call the callback with the error', function (ctx) {
        ctx.callback.calledWith(ctx.error).should.equal(true)
      })
    })

    describe('when not authorized', function () {
      beforeEach(function (ctx) {
        ctx.client.disconnect = sinon.stub()
        ctx.WebsocketController._assertClientCanApplyUpdate = sinon
          .stub()
          .yields((ctx.error = new Error('not authorized')))
        ctx.WebsocketController.applyOtUpdate(
          ctx.client,
          ctx.doc_id,
          ctx.update,
          ctx.callback
        )
      })

      // This happens in a setTimeout to allow the client a chance to receive the error first.
      // I'm not sure how to unit test, but it is acceptance tested.
      // it "should disconnect the client", ->
      // 	@client.disconnect.called.should.equal true

      it('should not log a warning', function (ctx) {
        ctx.logger.warn.called.should.equal(false)
      })

      it('should call the callback with the error', function (ctx) {
        ctx.callback.calledWith(ctx.error).should.equal(true)
      })
    })

    describe('update_too_large', function () {
      beforeEach(async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.client.disconnect = sinon.stub()
          ctx.client.emit = sinon.stub()
          ctx.client.ol_context.user_id = ctx.user_id
          ctx.client.ol_context.project_id = ctx.project_id
          const error = new UpdateTooLargeError(7372835)
          ctx.DocumentUpdaterManager.queueChange = sinon
            .stub()
            .callsArgWith(3, error)
          ctx.WebsocketController.applyOtUpdate(
            ctx.client,
            ctx.doc_id,
            ctx.update,
            ctx.callback
          )
          setTimeout(() => resolve(), 1)
        })
      })

      it('should call the callback with no error', function (ctx) {
        ctx.callback.called.should.equal(true)
        ctx.callback.args[0].should.deep.equal([])
      })

      it('should log a warning with the size and context', function (ctx) {
        ctx.logger.warn.called.should.equal(true)
        ctx.logger.warn.args[0].should.deep.equal([
          {
            userId: ctx.user_id,
            projectId: ctx.project_id,
            docId: ctx.doc_id,
            updateSize: 7372835,
          },
          'update is too large',
        ])
      })

      describe('after 100ms', function () {
        beforeEach(async function () {
          await new Promise(resolve => {
            setTimeout(resolve, 100)
          })
        })

        it('should send an otUpdateError the client', function (ctx) {
          ctx.client.emit.calledWith('otUpdateError').should.equal(true)
        })

        it('should disconnect the client', function (ctx) {
          ctx.client.disconnect.called.should.equal(true)
        })
      })

      describe('when the client disconnects during the next 100ms', function () {
        beforeEach(async function (ctx) {
          await new Promise((resolve, reject) => {
            ctx.client.disconnected = true
            setTimeout(resolve, 100)
          })
        })

        it('should not send an otUpdateError the client', function (ctx) {
          ctx.client.emit.calledWith('otUpdateError').should.equal(false)
        })

        it('should not disconnect the client', function (ctx) {
          ctx.client.disconnect.called.should.equal(false)
        })

        it('should increment the editor.doc-update.disconnected metric with a status', function (ctx) {
          expect(
            ctx.metrics.inc.calledWith('editor.doc-update.disconnected', 1, {
              status: 'at-otUpdateError',
            })
          ).to.equal(true)
        })
      })
    })
  })

  describe('_assertClientCanApplyUpdate', function () {
    beforeEach(function (ctx) {
      ctx.edit_update = {
        op: [
          { i: 'foo', p: 42 },
          { c: 'bar', p: 132 },
        ],
      } // comments may still be in an edit op
      ctx.comment_update = { op: [{ c: 'bar', p: 132 }] }
      ctx.AuthorizationManager.assertClientCanEditProjectAndDoc = sinon.stub()
      ctx.AuthorizationManager.assertClientCanReviewProjectAndDoc = sinon.stub()
      ctx.AuthorizationManager.assertClientCanViewProjectAndDoc = sinon.stub()
    })

    describe('with a read-write client', function () {
      it('should return successfully', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.AuthorizationManager.assertClientCanEditProjectAndDoc.yields(null)
          ctx.WebsocketController._assertClientCanApplyUpdate(
            ctx.client,
            ctx.doc_id,
            ctx.edit_update,
            error => {
              expect(error).to.be.null
              resolve()
            }
          )
        })
      })
    })

    describe('with a read-only client and an edit op', function () {
      it('should return an error', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.AuthorizationManager.assertClientCanEditProjectAndDoc.yields(
            new Error('not authorized')
          )
          ctx.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(null)
          ctx.WebsocketController._assertClientCanApplyUpdate(
            ctx.client,
            ctx.doc_id,
            ctx.edit_update,
            error => {
              expect(error.message).to.equal('not authorized')
              resolve()
            }
          )
        })
      })
    })

    describe('with a read-only client and a comment op', function () {
      it('should return successfully', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.AuthorizationManager.assertClientCanEditProjectAndDoc.yields(
            new Error('not authorized')
          )
          ctx.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(null)
          ctx.WebsocketController._assertClientCanApplyUpdate(
            ctx.client,
            ctx.doc_id,
            ctx.comment_update,
            error => {
              expect(error).to.be.null
              resolve()
            }
          )
        })
      })
    })

    describe('with a totally unauthorized client', function () {
      it('should return an error', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.AuthorizationManager.assertClientCanEditProjectAndDoc.yields(
            new Error('not authorized')
          )
          ctx.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(
            new Error('not authorized')
          )
          ctx.WebsocketController._assertClientCanApplyUpdate(
            ctx.client,
            ctx.doc_id,
            ctx.comment_update,
            error => {
              expect(error.message).to.equal('not authorized')
              resolve()
            }
          )
        })
      })
    })

    describe('with a review client', function () {
      it('op with tc should succeed', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.AuthorizationManager.assertClientCanEditProjectAndDoc.yields(
            new Error('not authorized')
          )
          ctx.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(null)
          ctx.AuthorizationManager.assertClientCanReviewProjectAndDoc.yields(
            null
          )
          ctx.WebsocketController._assertClientCanApplyUpdate(
            ctx.client,
            ctx.doc_id,
            { op: [{ p: 10, i: 'a' }], meta: { tc: '123456' } },
            error => {
              expect(error).to.be.null
              resolve()
            }
          )
        })
      })

      it('op without tc should fail', async function (ctx) {
        await new Promise((resolve, reject) => {
          ctx.AuthorizationManager.assertClientCanEditProjectAndDoc.yields(
            new Error('not authorized')
          )
          ctx.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(null)
          ctx.AuthorizationManager.assertClientCanReviewProjectAndDoc.yields(
            null
          )
          ctx.WebsocketController._assertClientCanApplyUpdate(
            ctx.client,
            ctx.doc_id,
            { op: [{ p: 10, i: 'a' }] },
            error => {
              expect(error.message).to.equal('not authorized')
              resolve()
            }
          )
        })
      })
    })
  })
})

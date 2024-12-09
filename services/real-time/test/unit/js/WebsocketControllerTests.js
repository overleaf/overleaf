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
const sinon = require('sinon')
const { expect } = require('chai')
const modulePath = '../../../app/js/WebsocketController.js'
const SandboxedModule = require('sandboxed-module')
const tk = require('timekeeper')
const { UpdateTooLargeError } = require('../../../app/js/Errors')

describe('WebsocketController', function () {
  beforeEach(function () {
    tk.freeze(new Date())
    this.project_id = 'project-id-123'
    this.user = {
      _id: (this.user_id = 'user-id-123'),
      first_name: 'James',
      last_name: 'Allen',
      email: 'james@example.com',
      signUpDate: new Date('2014-01-01'),
      loginCount: 42,
    }
    this.callback = sinon.stub()
    this.client = {
      disconnected: false,
      id: (this.client_id = 'mock-client-id-123'),
      publicId: `other-id-${Math.random()}`,
      ol_context: {},
      joinLeaveEpoch: 0,
      join: sinon.stub(),
      leave: sinon.stub(),
    }
    return (this.WebsocketController = SandboxedModule.require(modulePath, {
      requires: {
        './WebApiManager': (this.WebApiManager = {}),
        './AuthorizationManager': (this.AuthorizationManager = {}),
        './DocumentUpdaterManager': (this.DocumentUpdaterManager = {}),
        './ConnectedUsersManager': (this.ConnectedUsersManager = {}),
        './WebsocketLoadBalancer': (this.WebsocketLoadBalancer = {}),
        '@overleaf/metrics': (this.metrics = {
          inc: sinon.stub(),
          set: sinon.stub(),
        }),
        './RoomManager': (this.RoomManager = {}),
      },
    }))
  })

  afterEach(function () {
    return tk.reset()
  })

  describe('joinProject', function () {
    describe('when authorised', function () {
      beforeEach(function () {
        this.client.id = 'mock-client-id'
        this.project = {
          name: 'Test Project',
          owner: {
            _id: (this.owner_id = 'mock-owner-id-123'),
          },
        }
        this.privilegeLevel = 'owner'
        this.ConnectedUsersManager.updateUserPosition = sinon
          .stub()
          .callsArgAsync(4)
        this.isRestrictedUser = true
        this.isTokenMember = true
        this.isInvitedMember = true
        this.WebApiManager.joinProject = sinon
          .stub()
          .callsArgWith(2, null, this.project, this.privilegeLevel, {
            isRestrictedUser: this.isRestrictedUser,
            isTokenMember: this.isTokenMember,
            isInvitedMember: this.isInvitedMember,
          })
        this.RoomManager.joinProject = sinon.stub().callsArg(2)
        return this.WebsocketController.joinProject(
          this.client,
          this.user,
          this.project_id,
          this.callback
        )
      })

      it('should load the project from web', function () {
        return this.WebApiManager.joinProject
          .calledWith(this.project_id, this.user)
          .should.equal(true)
      })

      it('should join the project room', function () {
        return this.RoomManager.joinProject
          .calledWith(this.client, this.project_id)
          .should.equal(true)
      })

      it('should set the privilege level on the client', function () {
        return this.client.ol_context.privilege_level.should.equal(
          this.privilegeLevel
        )
      })
      it("should set the user's id on the client", function () {
        return this.client.ol_context.user_id.should.equal(this.user._id)
      })
      it("should set the user's email on the client", function () {
        return this.client.ol_context.email.should.equal(this.user.email)
      })
      it("should set the user's first_name on the client", function () {
        return this.client.ol_context.first_name.should.equal(
          this.user.first_name
        )
      })
      it("should set the user's last_name on the client", function () {
        return this.client.ol_context.last_name.should.equal(
          this.user.last_name
        )
      })
      it("should set the user's sign up date on the client", function () {
        return this.client.ol_context.signup_date.should.equal(
          this.user.signUpDate
        )
      })
      it("should set the user's login_count on the client", function () {
        return this.client.ol_context.login_count.should.equal(
          this.user.loginCount
        )
      })
      it('should set the connected time on the client', function () {
        return this.client.ol_context.connected_time.should.equal(new Date())
      })
      it('should set the project_id on the client', function () {
        return this.client.ol_context.project_id.should.equal(this.project_id)
      })
      it('should set the project owner id on the client', function () {
        return this.client.ol_context.owner_id.should.equal(this.owner_id)
      })
      it('should set the is_restricted_user flag on the client', function () {
        return this.client.ol_context.is_restricted_user.should.equal(
          this.isRestrictedUser
        )
      })
      it('should set the is_token_member flag on the client', function () {
        this.client.ol_context.is_token_member.should.equal(this.isTokenMember)
      })
      it('should set the is_invited_member flag on the client', function () {
        this.client.ol_context.is_invited_member.should.equal(
          this.isInvitedMember
        )
      })
      it('should call the callback with the project, privilegeLevel and protocolVersion', function () {
        return this.callback
          .calledWith(
            null,
            this.project,
            this.privilegeLevel,
            this.WebsocketController.PROTOCOL_VERSION
          )
          .should.equal(true)
      })

      it('should mark the user as connected in ConnectedUsersManager', function () {
        return this.ConnectedUsersManager.updateUserPosition
          .calledWith(this.project_id, this.client.publicId, this.user, null)
          .should.equal(true)
      })

      return it('should increment the join-project metric', function () {
        return this.metrics.inc
          .calledWith('editor.join-project')
          .should.equal(true)
      })
    })

    describe('when not authorized', function () {
      beforeEach(function () {
        this.WebApiManager.joinProject = sinon
          .stub()
          .callsArgWith(2, null, null, null)
        return this.WebsocketController.joinProject(
          this.client,
          this.user,
          this.project_id,
          this.callback
        )
      })

      it('should return an error', function () {
        return this.callback
          .calledWith(sinon.match({ message: 'not authorized' }))
          .should.equal(true)
      })

      return it('should not log an error', function () {
        return this.logger.error.called.should.equal(false)
      })
    })

    describe('when the subscribe failed', function () {
      beforeEach(function () {
        this.client.id = 'mock-client-id'
        this.project = {
          name: 'Test Project',
          owner: {
            _id: (this.owner_id = 'mock-owner-id-123'),
          },
        }
        this.privilegeLevel = 'owner'
        this.ConnectedUsersManager.updateUserPosition = sinon
          .stub()
          .callsArgAsync(4)
        this.isRestrictedUser = true
        this.isTokenMember = true
        this.isInvitedMember = true
        this.WebApiManager.joinProject = sinon
          .stub()
          .callsArgWith(2, null, this.project, this.privilegeLevel, {
            isRestrictedUser: this.isRestrictedUser,
            isTokenMember: this.isTokenMember,
            isInvitedMember: this.isInvitedMember,
          })
        this.RoomManager.joinProject = sinon
          .stub()
          .callsArgWith(2, new Error('subscribe failed'))
        return this.WebsocketController.joinProject(
          this.client,
          this.user,
          this.project_id,
          this.callback
        )
      })

      return it('should return an error', function () {
        this.callback
          .calledWith(sinon.match({ message: 'subscribe failed' }))
          .should.equal(true)
        return this.callback.args[0][0].message.should.equal('subscribe failed')
      })
    })

    describe('when the client has disconnected', function () {
      beforeEach(function () {
        this.client.disconnected = true
        this.WebApiManager.joinProject = sinon.stub().callsArg(2)
        return this.WebsocketController.joinProject(
          this.client,
          this.user,
          this.project_id,
          this.callback
        )
      })

      it('should not call WebApiManager.joinProject', function () {
        return expect(this.WebApiManager.joinProject.called).to.equal(false)
      })

      it('should call the callback with no details', function () {
        return expect(this.callback.args[0]).to.deep.equal([])
      })

      return it('should increment the editor.join-project.disconnected metric with a status', function () {
        return expect(
          this.metrics.inc.calledWith('editor.join-project.disconnected', 1, {
            status: 'immediately',
          })
        ).to.equal(true)
      })
    })

    return describe('when the client disconnects while WebApiManager.joinProject is running', function () {
      beforeEach(function () {
        this.WebApiManager.joinProject = (project, user, cb) => {
          this.client.disconnected = true
          return cb(null, this.project, this.privilegeLevel, {
            isRestrictedUser: this.isRestrictedUser,
            isTokenMember: this.isTokenMember,
            isInvitedMember: this.isInvitedMember,
          })
        }

        return this.WebsocketController.joinProject(
          this.client,
          this.user,
          this.project_id,
          this.callback
        )
      })

      it('should call the callback with no details', function () {
        return expect(this.callback.args[0]).to.deep.equal([])
      })

      return it('should increment the editor.join-project.disconnected metric with a status', function () {
        return expect(
          this.metrics.inc.calledWith('editor.join-project.disconnected', 1, {
            status: 'after-web-api-call',
          })
        ).to.equal(true)
      })
    })
  })

  describe('leaveProject', function () {
    beforeEach(function () {
      this.DocumentUpdaterManager.flushProjectToMongoAndDelete = sinon
        .stub()
        .callsArg(1)
      this.ConnectedUsersManager.markUserAsDisconnected = sinon
        .stub()
        .callsArg(2)
      this.WebsocketLoadBalancer.emitToRoom = sinon.stub()
      this.RoomManager.leaveProjectAndDocs = sinon.stub()
      this.clientsInRoom = []
      this.io = {
        sockets: {
          clients: roomId => {
            if (roomId !== this.project_id) {
              throw 'expected room_id to be project_id'
            }
            return this.clientsInRoom
          },
        },
      }
      this.client.ol_context.project_id = this.project_id
      this.client.ol_context.user_id = this.user_id
      this.WebsocketController.FLUSH_IF_EMPTY_DELAY = 0
      return tk.reset()
    }) // Allow setTimeout to work.

    describe('when the client did not joined a project yet', function () {
      beforeEach(function (done) {
        this.client.ol_context = {}
        return this.WebsocketController.leaveProject(this.io, this.client, done)
      })

      it('should bail out when calling leaveProject', function () {
        this.WebsocketLoadBalancer.emitToRoom.called.should.equal(false)
        this.RoomManager.leaveProjectAndDocs.called.should.equal(false)
        return this.ConnectedUsersManager.markUserAsDisconnected.called.should.equal(
          false
        )
      })

      return it('should not inc any metric', function () {
        return this.metrics.inc.called.should.equal(false)
      })
    })

    describe('when the project is empty', function () {
      beforeEach(function (done) {
        this.clientsInRoom = []
        return this.WebsocketController.leaveProject(this.io, this.client, done)
      })

      it('should end clientTracking.clientDisconnected to the project room', function () {
        return this.WebsocketLoadBalancer.emitToRoom
          .calledWith(
            this.project_id,
            'clientTracking.clientDisconnected',
            this.client.publicId
          )
          .should.equal(true)
      })

      it('should mark the user as disconnected', function () {
        return this.ConnectedUsersManager.markUserAsDisconnected
          .calledWith(this.project_id, this.client.publicId)
          .should.equal(true)
      })

      it('should flush the project in the document updater', function () {
        return this.DocumentUpdaterManager.flushProjectToMongoAndDelete
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should increment the leave-project metric', function () {
        return this.metrics.inc
          .calledWith('editor.leave-project')
          .should.equal(true)
      })

      return it('should track the disconnection in RoomManager', function () {
        return this.RoomManager.leaveProjectAndDocs
          .calledWith(this.client)
          .should.equal(true)
      })
    })

    describe('when the project is not empty', function () {
      beforeEach(function (done) {
        this.clientsInRoom = ['mock-remaining-client']
        this.io = {
          sockets: {
            clients: roomId => {
              if (roomId !== this.project_id) {
                throw 'expected room_id to be project_id'
              }
              return this.clientsInRoom
            },
          },
        }
        return this.WebsocketController.leaveProject(this.io, this.client, done)
      })

      return it('should not flush the project in the document updater', function () {
        return this.DocumentUpdaterManager.flushProjectToMongoAndDelete.called.should.equal(
          false
        )
      })
    })

    describe('when client has not authenticated', function () {
      beforeEach(function (done) {
        this.client.ol_context.user_id = null
        this.client.ol_context.project_id = null
        return this.WebsocketController.leaveProject(this.io, this.client, done)
      })

      it('should not end clientTracking.clientDisconnected to the project room', function () {
        return this.WebsocketLoadBalancer.emitToRoom
          .calledWith(
            this.project_id,
            'clientTracking.clientDisconnected',
            this.client.publicId
          )
          .should.equal(false)
      })

      it('should not mark the user as disconnected', function () {
        return this.ConnectedUsersManager.markUserAsDisconnected
          .calledWith(this.project_id, this.client.publicId)
          .should.equal(false)
      })

      it('should not flush the project in the document updater', function () {
        return this.DocumentUpdaterManager.flushProjectToMongoAndDelete
          .calledWith(this.project_id)
          .should.equal(false)
      })

      return it('should not increment the leave-project metric', function () {
        return this.metrics.inc
          .calledWith('editor.leave-project')
          .should.equal(false)
      })
    })

    return describe('when client has not joined a project', function () {
      beforeEach(function (done) {
        this.client.ol_context.user_id = this.user_id
        this.client.ol_context.project_id = null
        return this.WebsocketController.leaveProject(this.io, this.client, done)
      })

      it('should not end clientTracking.clientDisconnected to the project room', function () {
        return this.WebsocketLoadBalancer.emitToRoom
          .calledWith(
            this.project_id,
            'clientTracking.clientDisconnected',
            this.client.publicId
          )
          .should.equal(false)
      })

      it('should not mark the user as disconnected', function () {
        return this.ConnectedUsersManager.markUserAsDisconnected
          .calledWith(this.project_id, this.client.publicId)
          .should.equal(false)
      })

      it('should not flush the project in the document updater', function () {
        return this.DocumentUpdaterManager.flushProjectToMongoAndDelete
          .calledWith(this.project_id)
          .should.equal(false)
      })

      return it('should not increment the leave-project metric', function () {
        return this.metrics.inc
          .calledWith('editor.leave-project')
          .should.equal(false)
      })
    })
  })

  describe('joinDoc', function () {
    beforeEach(function () {
      this.doc_id = 'doc-id-123'
      this.doc_lines = ['doc', 'lines']
      this.version = 42
      this.ops = ['mock', 'ops']
      this.ranges = { mock: 'ranges' }
      this.options = {}

      this.client.ol_context.project_id = this.project_id
      this.client.ol_context.is_restricted_user = false
      this.AuthorizationManager.addAccessToDoc = sinon.stub().yields()
      this.AuthorizationManager.assertClientCanViewProject = sinon
        .stub()
        .callsArgWith(1, null)
      this.AuthorizationManager.assertClientCanViewProjectAndDoc = sinon
        .stub()
        .callsArgWith(2, null)
      this.DocumentUpdaterManager.getDocument = sinon
        .stub()
        .callsArgWith(
          3,
          null,
          this.doc_lines,
          this.version,
          this.ranges,
          this.ops
        )
      return (this.RoomManager.joinDoc = sinon.stub().callsArg(2))
    })

    describe('works', function () {
      beforeEach(function () {
        return this.WebsocketController.joinDoc(
          this.client,
          this.doc_id,
          -1,
          this.options,
          this.callback
        )
      })

      it('should inc the joinLeaveEpoch', function () {
        expect(this.client.joinLeaveEpoch).to.equal(1)
      })

      it('should check that the client is authorized to view the project', function () {
        return this.AuthorizationManager.assertClientCanViewProject
          .calledWith(this.client)
          .should.equal(true)
      })

      it('should get the document from the DocumentUpdaterManager with fromVersion', function () {
        return this.DocumentUpdaterManager.getDocument
          .calledWith(this.project_id, this.doc_id, -1)
          .should.equal(true)
      })

      it('should add permissions for the client to access the doc', function () {
        return this.AuthorizationManager.addAccessToDoc
          .calledWith(this.client, this.doc_id)
          .should.equal(true)
      })

      it('should join the client to room for the doc_id', function () {
        return this.RoomManager.joinDoc
          .calledWith(this.client, this.doc_id)
          .should.equal(true)
      })

      it('should call the callback with the lines, version, ranges and ops', function () {
        return this.callback
          .calledWith(null, this.doc_lines, this.version, this.ops, this.ranges)
          .should.equal(true)
      })

      return it('should increment the join-doc metric', function () {
        return this.metrics.inc.calledWith('editor.join-doc').should.equal(true)
      })
    })

    describe('with a fromVersion', function () {
      beforeEach(function () {
        this.fromVersion = 40
        return this.WebsocketController.joinDoc(
          this.client,
          this.doc_id,
          this.fromVersion,
          this.options,
          this.callback
        )
      })

      return it('should get the document from the DocumentUpdaterManager with fromVersion', function () {
        return this.DocumentUpdaterManager.getDocument
          .calledWith(this.project_id, this.doc_id, this.fromVersion)
          .should.equal(true)
      })
    })

    describe('with doclines that need escaping', function () {
      beforeEach(function () {
        this.doc_lines.push(['räksmörgås'])
        return this.WebsocketController.joinDoc(
          this.client,
          this.doc_id,
          -1,
          this.options,
          this.callback
        )
      })

      return it('should call the callback with the escaped lines', function () {
        const escapedLines = this.callback.args[0][1]
        const escapedWord = escapedLines.pop()
        escapedWord.should.equal('rÃ¤ksmÃ¶rgÃ¥s')
        // Check that unescaping works
        return decodeURIComponent(escape(escapedWord)).should.equal(
          'räksmörgås'
        )
      })
    })

    describe('with comments that need encoding', function () {
      beforeEach(function () {
        this.ranges.comments = [{ op: { c: 'räksmörgås' } }]
        return this.WebsocketController.joinDoc(
          this.client,
          this.doc_id,
          -1,
          { encodeRanges: true },
          this.callback
        )
      })

      return it('should call the callback with the encoded comment', function () {
        const encodedComments = this.callback.args[0][4]
        const encodedComment = encodedComments.comments.pop()
        const encodedCommentText = encodedComment.op.c
        return encodedCommentText.should.equal('rÃ¤ksmÃ¶rgÃ¥s')
      })
    })

    describe('with changes that need encoding', function () {
      it('should call the callback with the encoded insert change', function () {
        this.ranges.changes = [{ op: { i: 'räksmörgås' } }]
        this.WebsocketController.joinDoc(
          this.client,
          this.doc_id,
          -1,
          { encodeRanges: true },
          this.callback
        )

        const encodedChanges = this.callback.args[0][4]
        const encodedChange = encodedChanges.changes.pop()
        const encodedChangeText = encodedChange.op.i
        return encodedChangeText.should.equal('rÃ¤ksmÃ¶rgÃ¥s')
      })

      return it('should call the callback with the encoded delete change', function () {
        this.ranges.changes = [{ op: { d: 'räksmörgås' } }]
        this.WebsocketController.joinDoc(
          this.client,
          this.doc_id,
          -1,
          { encodeRanges: true },
          this.callback
        )

        const encodedChanges = this.callback.args[0][4]
        const encodedChange = encodedChanges.changes.pop()
        const encodedChangeText = encodedChange.op.d
        return encodedChangeText.should.equal('rÃ¤ksmÃ¶rgÃ¥s')
      })
    })

    describe('when not authorized', function () {
      beforeEach(function () {
        this.AuthorizationManager.assertClientCanViewProject = sinon
          .stub()
          .callsArgWith(1, (this.err = new Error('not authorized')))
        return this.WebsocketController.joinDoc(
          this.client,
          this.doc_id,
          -1,
          this.options,
          this.callback
        )
      })

      it('should call the callback with an error', function () {
        return this.callback
          .calledWith(sinon.match({ message: 'not authorized' }))
          .should.equal(true)
      })

      return it('should not call the DocumentUpdaterManager', function () {
        return this.DocumentUpdaterManager.getDocument.called.should.equal(
          false
        )
      })
    })

    describe('with a restricted client', function () {
      beforeEach(function () {
        this.ranges.comments = [{ op: { a: 1 } }, { op: { a: 2 } }]
        this.client.ol_context.is_restricted_user = true
        return this.WebsocketController.joinDoc(
          this.client,
          this.doc_id,
          -1,
          this.options,
          this.callback
        )
      })

      return it('should overwrite ranges.comments with an empty list', function () {
        const ranges = this.callback.args[0][4]
        return expect(ranges.comments).to.deep.equal([])
      })
    })

    describe('when the client has disconnected', function () {
      beforeEach(function () {
        this.client.disconnected = true
        return this.WebsocketController.joinDoc(
          this.client,
          this.doc_id,
          -1,
          this.options,
          this.callback
        )
      })

      it('should call the callback with no details', function () {
        return expect(this.callback.args[0]).to.deep.equal([])
      })

      it('should increment the editor.join-doc.disconnected metric with a status', function () {
        return expect(
          this.metrics.inc.calledWith('editor.join-doc.disconnected', 1, {
            status: 'immediately',
          })
        ).to.equal(true)
      })

      return it('should not get the document', function () {
        return expect(this.DocumentUpdaterManager.getDocument.called).to.equal(
          false
        )
      })
    })

    describe('when the client disconnects while auth checks are running', function () {
      beforeEach(function (done) {
        this.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(
          new Error()
        )
        this.DocumentUpdaterManager.checkDocument = (projectId, docId, cb) => {
          this.client.disconnected = true
          cb()
        }

        this.WebsocketController.joinDoc(
          this.client,
          this.doc_id,
          -1,
          this.options,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('should call the callback with no details', function () {
        expect(this.callback.called).to.equal(true)
        expect(this.callback.args[0]).to.deep.equal([])
      })

      it('should increment the editor.join-doc.disconnected metric with a status', function () {
        expect(
          this.metrics.inc.calledWith('editor.join-doc.disconnected', 1, {
            status: 'after-client-auth-check',
          })
        ).to.equal(true)
      })

      it('should not get the document', function () {
        expect(this.DocumentUpdaterManager.getDocument.called).to.equal(false)
      })
    })

    describe('when the client starts a parallel joinDoc request', function () {
      beforeEach(function (done) {
        this.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(
          new Error()
        )
        this.DocumentUpdaterManager.checkDocument = (projectId, docId, cb) => {
          this.DocumentUpdaterManager.checkDocument = sinon.stub().yields()
          this.WebsocketController.joinDoc(
            this.client,
            this.doc_id,
            -1,
            {},
            () => {}
          )
          cb()
        }

        this.WebsocketController.joinDoc(
          this.client,
          this.doc_id,
          -1,
          this.options,
          (...args) => {
            this.callback(...args)
            // make sure the other joinDoc request completed
            setTimeout(done, 5)
          }
        )
      })

      it('should call the callback with an error', function () {
        expect(this.callback.called).to.equal(true)
        expect(this.callback.args[0][0].message).to.equal(
          'joinLeaveEpoch mismatch'
        )
      })

      it('should get the document once (the parallel request wins)', function () {
        expect(this.DocumentUpdaterManager.getDocument.callCount).to.equal(1)
      })
    })

    describe('when the client starts a parallel leaveDoc request', function () {
      beforeEach(function (done) {
        this.RoomManager.leaveDoc = sinon.stub()

        this.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(
          new Error()
        )
        this.DocumentUpdaterManager.checkDocument = (projectId, docId, cb) => {
          this.WebsocketController.leaveDoc(this.client, this.doc_id, () => {})
          cb()
        }

        this.WebsocketController.joinDoc(
          this.client,
          this.doc_id,
          -1,
          this.options,
          (...args) => {
            this.callback(...args)
            done()
          }
        )
      })

      it('should call the callback with an error', function () {
        expect(this.callback.called).to.equal(true)
        expect(this.callback.args[0][0].message).to.equal(
          'joinLeaveEpoch mismatch'
        )
      })

      it('should not get the document', function () {
        expect(this.DocumentUpdaterManager.getDocument.called).to.equal(false)
      })
    })

    describe('when the client disconnects while RoomManager.joinDoc is running', function () {
      beforeEach(function () {
        this.RoomManager.joinDoc = (client, docId, cb) => {
          this.client.disconnected = true
          return cb()
        }

        return this.WebsocketController.joinDoc(
          this.client,
          this.doc_id,
          -1,
          this.options,
          this.callback
        )
      })

      it('should call the callback with no details', function () {
        return expect(this.callback.args[0]).to.deep.equal([])
      })

      it('should increment the editor.join-doc.disconnected metric with a status', function () {
        return expect(
          this.metrics.inc.calledWith('editor.join-doc.disconnected', 1, {
            status: 'after-joining-room',
          })
        ).to.equal(true)
      })

      return it('should not get the document', function () {
        return expect(this.DocumentUpdaterManager.getDocument.called).to.equal(
          false
        )
      })
    })

    return describe('when the client disconnects while DocumentUpdaterManager.getDocument is running', function () {
      beforeEach(function () {
        this.DocumentUpdaterManager.getDocument = (
          projectId,
          docId,
          fromVersion,
          callback
        ) => {
          this.client.disconnected = true
          return callback(
            null,
            this.doc_lines,
            this.version,
            this.ranges,
            this.ops
          )
        }

        return this.WebsocketController.joinDoc(
          this.client,
          this.doc_id,
          -1,
          this.options,
          this.callback
        )
      })

      it('should call the callback with no details', function () {
        return expect(this.callback.args[0]).to.deep.equal([])
      })

      return it('should increment the editor.join-doc.disconnected metric with a status', function () {
        return expect(
          this.metrics.inc.calledWith('editor.join-doc.disconnected', 1, {
            status: 'after-doc-updater-call',
          })
        ).to.equal(true)
      })
    })
  })

  describe('leaveDoc', function () {
    beforeEach(function () {
      this.doc_id = 'doc-id-123'
      this.client.ol_context.project_id = this.project_id
      this.RoomManager.leaveDoc = sinon.stub()
      return this.WebsocketController.leaveDoc(
        this.client,
        this.doc_id,
        this.callback
      )
    })

    it('should inc the joinLeaveEpoch', function () {
      expect(this.client.joinLeaveEpoch).to.equal(1)
    })

    it('should remove the client from the doc_id room', function () {
      return this.RoomManager.leaveDoc
        .calledWith(this.client, this.doc_id)
        .should.equal(true)
    })

    it('should call the callback', function () {
      return this.callback.called.should.equal(true)
    })

    return it('should increment the leave-doc metric', function () {
      return this.metrics.inc.calledWith('editor.leave-doc').should.equal(true)
    })
  })

  describe('getConnectedUsers', function () {
    beforeEach(function () {
      this.client.ol_context.project_id = this.project_id
      this.users = ['mock', 'users']
      this.WebsocketLoadBalancer.emitToRoom = sinon.stub()
      return (this.ConnectedUsersManager.getConnectedUsers = sinon
        .stub()
        .callsArgWith(1, null, this.users))
    })

    describe('when authorized', function () {
      beforeEach(function (done) {
        this.AuthorizationManager.assertClientCanViewProject = sinon
          .stub()
          .callsArgWith(1, null)
        return this.WebsocketController.getConnectedUsers(
          this.client,
          (...args) => {
            this.callback(...Array.from(args || []))
            return done()
          }
        )
      })

      it('should check that the client is authorized to view the project', function () {
        return this.AuthorizationManager.assertClientCanViewProject
          .calledWith(this.client)
          .should.equal(true)
      })

      it('should broadcast a request to update the client list', function () {
        return this.WebsocketLoadBalancer.emitToRoom
          .calledWith(this.project_id, 'clientTracking.refresh')
          .should.equal(true)
      })

      it('should get the connected users for the project', function () {
        return this.ConnectedUsersManager.getConnectedUsers
          .calledWith(this.project_id)
          .should.equal(true)
      })

      it('should return the users', function () {
        return this.callback.calledWith(null, this.users).should.equal(true)
      })

      return it('should increment the get-connected-users metric', function () {
        return this.metrics.inc
          .calledWith('editor.get-connected-users')
          .should.equal(true)
      })
    })

    describe('when not authorized', function () {
      beforeEach(function () {
        this.AuthorizationManager.assertClientCanViewProject = sinon
          .stub()
          .callsArgWith(1, (this.err = new Error('not authorized')))
        return this.WebsocketController.getConnectedUsers(
          this.client,
          this.callback
        )
      })

      it('should not get the connected users for the project', function () {
        return this.ConnectedUsersManager.getConnectedUsers.called.should.equal(
          false
        )
      })

      return it('should return an error', function () {
        return this.callback.calledWith(this.err).should.equal(true)
      })
    })

    describe('when restricted user', function () {
      beforeEach(function () {
        this.client.ol_context.is_restricted_user = true
        this.AuthorizationManager.assertClientCanViewProject = sinon
          .stub()
          .callsArgWith(1, null)
        return this.WebsocketController.getConnectedUsers(
          this.client,
          this.callback
        )
      })

      it('should return an empty array of users', function () {
        return this.callback.calledWith(null, []).should.equal(true)
      })

      return it('should not get the connected users for the project', function () {
        return this.ConnectedUsersManager.getConnectedUsers.called.should.equal(
          false
        )
      })
    })

    return describe('when the client has disconnected', function () {
      beforeEach(function () {
        this.client.disconnected = true
        this.AuthorizationManager.assertClientCanViewProject = sinon.stub()
        return this.WebsocketController.getConnectedUsers(
          this.client,
          this.callback
        )
      })

      it('should call the callback with no details', function () {
        return expect(this.callback.args[0]).to.deep.equal([])
      })

      return it('should not check permissions', function () {
        return expect(
          this.AuthorizationManager.assertClientCanViewProject.called
        ).to.equal(false)
      })
    })
  })

  describe('updateClientPosition', function () {
    beforeEach(function () {
      this.WebsocketLoadBalancer.emitToRoom = sinon.stub()
      this.ConnectedUsersManager.updateUserPosition = sinon
        .stub()
        .callsArgAsync(4)
      this.AuthorizationManager.assertClientCanViewProjectAndDoc = sinon
        .stub()
        .callsArgWith(2, null)
      return (this.update = {
        doc_id: (this.doc_id = 'doc-id-123'),
        row: (this.row = 42),
        column: (this.column = 37),
      })
    })

    describe('with a logged in user', function () {
      beforeEach(function (done) {
        this.client.ol_context = {
          project_id: this.project_id,
          first_name: (this.first_name = 'Douglas'),
          last_name: (this.last_name = 'Adams'),
          email: (this.email = 'joe@example.com'),
          user_id: (this.user_id = 'user-id-123'),
        }

        this.populatedCursorData = {
          doc_id: this.doc_id,
          id: this.client.publicId,
          name: `${this.first_name} ${this.last_name}`,
          row: this.row,
          column: this.column,
          email: this.email,
          user_id: this.user_id,
        }
        this.WebsocketController.updateClientPosition(
          this.client,
          this.update,
          done
        )
      })

      it("should send the update to the project room with the user's name", function () {
        return this.WebsocketLoadBalancer.emitToRoom
          .calledWith(
            this.project_id,
            'clientTracking.clientUpdated',
            this.populatedCursorData
          )
          .should.equal(true)
      })

      it('should send the  cursor data to the connected user manager', function (done) {
        this.ConnectedUsersManager.updateUserPosition
          .calledWith(
            this.project_id,
            this.client.publicId,
            {
              _id: this.user_id,
              email: this.email,
              first_name: this.first_name,
              last_name: this.last_name,
            },
            {
              row: this.row,
              column: this.column,
              doc_id: this.doc_id,
            }
          )
          .should.equal(true)
        return done()
      })

      return it('should increment the update-client-position metric at 0.1 frequency', function () {
        return this.metrics.inc
          .calledWith('editor.update-client-position', 0.1)
          .should.equal(true)
      })
    })

    describe('with a logged in user who has no last_name set', function () {
      beforeEach(function (done) {
        this.client.ol_context = {
          project_id: this.project_id,
          first_name: (this.first_name = 'Douglas'),
          last_name: undefined,
          email: (this.email = 'joe@example.com'),
          user_id: (this.user_id = 'user-id-123'),
        }

        this.populatedCursorData = {
          doc_id: this.doc_id,
          id: this.client.publicId,
          name: `${this.first_name}`,
          row: this.row,
          column: this.column,
          email: this.email,
          user_id: this.user_id,
        }
        this.WebsocketController.updateClientPosition(
          this.client,
          this.update,
          done
        )
      })

      it("should send the update to the project room with the user's name", function () {
        return this.WebsocketLoadBalancer.emitToRoom
          .calledWith(
            this.project_id,
            'clientTracking.clientUpdated',
            this.populatedCursorData
          )
          .should.equal(true)
      })

      it('should send the  cursor data to the connected user manager', function (done) {
        this.ConnectedUsersManager.updateUserPosition
          .calledWith(
            this.project_id,
            this.client.publicId,
            {
              _id: this.user_id,
              email: this.email,
              first_name: this.first_name,
              last_name: undefined,
            },
            {
              row: this.row,
              column: this.column,
              doc_id: this.doc_id,
            }
          )
          .should.equal(true)
        return done()
      })

      return it('should increment the update-client-position metric at 0.1 frequency', function () {
        return this.metrics.inc
          .calledWith('editor.update-client-position', 0.1)
          .should.equal(true)
      })
    })

    describe('with a logged in user who has no first_name set', function () {
      beforeEach(function (done) {
        this.client.ol_context = {
          project_id: this.project_id,
          first_name: undefined,
          last_name: (this.last_name = 'Adams'),
          email: (this.email = 'joe@example.com'),
          user_id: (this.user_id = 'user-id-123'),
        }

        this.populatedCursorData = {
          doc_id: this.doc_id,
          id: this.client.publicId,
          name: `${this.last_name}`,
          row: this.row,
          column: this.column,
          email: this.email,
          user_id: this.user_id,
        }
        this.WebsocketController.updateClientPosition(
          this.client,
          this.update,
          done
        )
      })

      it("should send the update to the project room with the user's name", function () {
        return this.WebsocketLoadBalancer.emitToRoom
          .calledWith(
            this.project_id,
            'clientTracking.clientUpdated',
            this.populatedCursorData
          )
          .should.equal(true)
      })

      it('should send the  cursor data to the connected user manager', function (done) {
        this.ConnectedUsersManager.updateUserPosition
          .calledWith(
            this.project_id,
            this.client.publicId,
            {
              _id: this.user_id,
              email: this.email,
              first_name: undefined,
              last_name: this.last_name,
            },
            {
              row: this.row,
              column: this.column,
              doc_id: this.doc_id,
            }
          )
          .should.equal(true)
        return done()
      })

      return it('should increment the update-client-position metric at 0.1 frequency', function () {
        return this.metrics.inc
          .calledWith('editor.update-client-position', 0.1)
          .should.equal(true)
      })
    })
    describe('with a logged in user who has no names set', function () {
      beforeEach(function (done) {
        this.client.ol_context = {
          project_id: this.project_id,
          first_name: undefined,
          last_name: undefined,
          email: (this.email = 'joe@example.com'),
          user_id: (this.user_id = 'user-id-123'),
        }
        return this.WebsocketController.updateClientPosition(
          this.client,
          this.update,
          done
        )
      })

      return it('should send the update to the project name with no name', function () {
        return this.WebsocketLoadBalancer.emitToRoom
          .calledWith(this.project_id, 'clientTracking.clientUpdated', {
            doc_id: this.doc_id,
            id: this.client.publicId,
            user_id: this.user_id,
            name: '',
            row: this.row,
            column: this.column,
            email: this.email,
          })
          .should.equal(true)
      })
    })

    describe('with an anonymous user', function () {
      beforeEach(function (done) {
        this.client.ol_context = {
          project_id: this.project_id,
        }
        return this.WebsocketController.updateClientPosition(
          this.client,
          this.update,
          done
        )
      })

      it('should send the update to the project room with no name', function () {
        return this.WebsocketLoadBalancer.emitToRoom
          .calledWith(this.project_id, 'clientTracking.clientUpdated', {
            doc_id: this.doc_id,
            id: this.client.publicId,
            name: '',
            row: this.row,
            column: this.column,
          })
          .should.equal(true)
      })

      return it('should not send cursor data to the connected user manager', function (done) {
        this.ConnectedUsersManager.updateUserPosition.called.should.equal(false)
        return done()
      })
    })

    return describe('when the client has disconnected', function () {
      beforeEach(function (done) {
        this.client.disconnected = true
        this.AuthorizationManager.assertClientCanViewProjectAndDoc =
          sinon.stub()
        return this.WebsocketController.updateClientPosition(
          this.client,
          this.update,
          (...args) => {
            this.callback(...args)
            done(args[0])
          }
        )
      })

      it('should call the callback with no details', function () {
        return expect(this.callback.args[0]).to.deep.equal([])
      })

      return it('should not check permissions', function () {
        return expect(
          this.AuthorizationManager.assertClientCanViewProjectAndDoc.called
        ).to.equal(false)
      })
    })
  })

  describe('applyOtUpdate', function () {
    beforeEach(function () {
      this.update = { op: { p: 12, t: 'foo' } }
      this.client.ol_context.user_id = this.user_id
      this.client.ol_context.project_id = this.project_id
      this.WebsocketController._assertClientCanApplyUpdate = sinon
        .stub()
        .yields()
      return (this.DocumentUpdaterManager.queueChange = sinon
        .stub()
        .callsArg(3))
    })

    describe('succesfully', function () {
      beforeEach(function () {
        return this.WebsocketController.applyOtUpdate(
          this.client,
          this.doc_id,
          this.update,
          this.callback
        )
      })

      it('should set the source of the update to the client id', function () {
        return this.update.meta.source.should.equal(this.client.publicId)
      })

      it('should set the user_id of the update to the user id', function () {
        return this.update.meta.user_id.should.equal(this.user_id)
      })

      it('should queue the update', function () {
        return this.DocumentUpdaterManager.queueChange
          .calledWith(this.project_id, this.doc_id, this.update)
          .should.equal(true)
      })

      it('should call the callback', function () {
        return this.callback.called.should.equal(true)
      })

      return it('should increment the doc updates', function () {
        return this.metrics.inc
          .calledWith('editor.doc-update')
          .should.equal(true)
      })
    })

    describe('unsuccessfully', function () {
      beforeEach(function () {
        this.client.disconnect = sinon.stub()
        this.DocumentUpdaterManager.queueChange = sinon
          .stub()
          .callsArgWith(3, (this.error = new Error('Something went wrong')))
        return this.WebsocketController.applyOtUpdate(
          this.client,
          this.doc_id,
          this.update,
          this.callback
        )
      })

      it('should disconnect the client', function () {
        return this.client.disconnect.called.should.equal(true)
      })

      it('should not log an error', function () {
        return this.logger.error.called.should.equal(false)
      })

      return it('should call the callback with the error', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })

    describe('when not authorized', function () {
      beforeEach(function () {
        this.client.disconnect = sinon.stub()
        this.WebsocketController._assertClientCanApplyUpdate = sinon
          .stub()
          .yields((this.error = new Error('not authorized')))
        return this.WebsocketController.applyOtUpdate(
          this.client,
          this.doc_id,
          this.update,
          this.callback
        )
      })

      // This happens in a setTimeout to allow the client a chance to receive the error first.
      // I'm not sure how to unit test, but it is acceptance tested.
      // it "should disconnect the client", ->
      // 	@client.disconnect.called.should.equal true

      it('should not log a warning', function () {
        return this.logger.warn.called.should.equal(false)
      })

      return it('should call the callback with the error', function () {
        return this.callback.calledWith(this.error).should.equal(true)
      })
    })

    return describe('update_too_large', function () {
      beforeEach(function (done) {
        this.client.disconnect = sinon.stub()
        this.client.emit = sinon.stub()
        this.client.ol_context.user_id = this.user_id
        this.client.ol_context.project_id = this.project_id
        const error = new UpdateTooLargeError(7372835)
        this.DocumentUpdaterManager.queueChange = sinon
          .stub()
          .callsArgWith(3, error)
        this.WebsocketController.applyOtUpdate(
          this.client,
          this.doc_id,
          this.update,
          this.callback
        )
        return setTimeout(() => done(), 1)
      })

      it('should call the callback with no error', function () {
        this.callback.called.should.equal(true)
        return this.callback.args[0].should.deep.equal([])
      })

      it('should log a warning with the size and context', function () {
        this.logger.warn.called.should.equal(true)
        return this.logger.warn.args[0].should.deep.equal([
          {
            userId: this.user_id,
            projectId: this.project_id,
            docId: this.doc_id,
            updateSize: 7372835,
          },
          'update is too large',
        ])
      })

      describe('after 100ms', function () {
        beforeEach(function (done) {
          return setTimeout(done, 100)
        })

        it('should send an otUpdateError the client', function () {
          return this.client.emit.calledWith('otUpdateError').should.equal(true)
        })

        return it('should disconnect the client', function () {
          return this.client.disconnect.called.should.equal(true)
        })
      })

      return describe('when the client disconnects during the next 100ms', function () {
        beforeEach(function (done) {
          this.client.disconnected = true
          return setTimeout(done, 100)
        })

        it('should not send an otUpdateError the client', function () {
          return this.client.emit
            .calledWith('otUpdateError')
            .should.equal(false)
        })

        it('should not disconnect the client', function () {
          return this.client.disconnect.called.should.equal(false)
        })

        return it('should increment the editor.doc-update.disconnected metric with a status', function () {
          return expect(
            this.metrics.inc.calledWith('editor.doc-update.disconnected', 1, {
              status: 'at-otUpdateError',
            })
          ).to.equal(true)
        })
      })
    })
  })

  return describe('_assertClientCanApplyUpdate', function () {
    beforeEach(function () {
      this.edit_update = {
        op: [
          { i: 'foo', p: 42 },
          { c: 'bar', p: 132 },
        ],
      } // comments may still be in an edit op
      this.comment_update = { op: [{ c: 'bar', p: 132 }] }
      this.AuthorizationManager.assertClientCanEditProjectAndDoc = sinon.stub()
      this.AuthorizationManager.assertClientCanReviewProjectAndDoc =
        sinon.stub()
      return (this.AuthorizationManager.assertClientCanViewProjectAndDoc =
        sinon.stub())
    })

    describe('with a read-write client', function () {
      return it('should return successfully', function (done) {
        this.AuthorizationManager.assertClientCanEditProjectAndDoc.yields(null)
        return this.WebsocketController._assertClientCanApplyUpdate(
          this.client,
          this.doc_id,
          this.edit_update,
          error => {
            expect(error).to.be.null
            return done()
          }
        )
      })
    })

    describe('with a read-only client and an edit op', function () {
      return it('should return an error', function (done) {
        this.AuthorizationManager.assertClientCanEditProjectAndDoc.yields(
          new Error('not authorized')
        )
        this.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(null)
        return this.WebsocketController._assertClientCanApplyUpdate(
          this.client,
          this.doc_id,
          this.edit_update,
          error => {
            expect(error.message).to.equal('not authorized')
            return done()
          }
        )
      })
    })

    describe('with a read-only client and a comment op', function () {
      return it('should return successfully', function (done) {
        this.AuthorizationManager.assertClientCanEditProjectAndDoc.yields(
          new Error('not authorized')
        )
        this.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(null)
        return this.WebsocketController._assertClientCanApplyUpdate(
          this.client,
          this.doc_id,
          this.comment_update,
          error => {
            expect(error).to.be.null
            return done()
          }
        )
      })
    })

    describe('with a totally unauthorized client', function () {
      return it('should return an error', function (done) {
        this.AuthorizationManager.assertClientCanEditProjectAndDoc.yields(
          new Error('not authorized')
        )
        this.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(
          new Error('not authorized')
        )
        return this.WebsocketController._assertClientCanApplyUpdate(
          this.client,
          this.doc_id,
          this.comment_update,
          error => {
            expect(error.message).to.equal('not authorized')
            return done()
          }
        )
      })
    })

    describe('with a review client', function () {
      it('op with tc should succeed', function (done) {
        this.AuthorizationManager.assertClientCanEditProjectAndDoc.yields(
          new Error('not authorized')
        )
        this.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(null)
        this.AuthorizationManager.assertClientCanReviewProjectAndDoc.yields(
          null
        )
        return this.WebsocketController._assertClientCanApplyUpdate(
          this.client,
          this.doc_id,
          { op: [{ p: 10, i: 'a' }], meta: { tc: '123456' } },
          error => {
            expect(error).to.be.null
            return done()
          }
        )
      })

      return it('op without tc should fail', function (done) {
        this.AuthorizationManager.assertClientCanEditProjectAndDoc.yields(
          new Error('not authorized')
        )
        this.AuthorizationManager.assertClientCanViewProjectAndDoc.yields(null)
        this.AuthorizationManager.assertClientCanReviewProjectAndDoc.yields(
          null
        )
        return this.WebsocketController._assertClientCanApplyUpdate(
          this.client,
          this.doc_id,
          { op: [{ p: 10, i: 'a' }] },
          error => {
            expect(error.message).to.equal('not authorized')
            return done()
          }
        )
      })
    })
  })
})

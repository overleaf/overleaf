/* eslint-disable
    chai-friendly/no-unused-expressions,
    handle-callback-err,
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * DS206: Consider reworking classes to avoid initClass
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath =
  '../../../../app/src/Features/Collaborators/CollaboratorsInviteHandler.js'
const SandboxedModule = require('sandboxed-module')
const events = require('events')
const { ObjectId } = require('mongojs')
const Crypto = require('crypto')

describe('CollaboratorsInviteHandler', function() {
  beforeEach(function() {
    let ProjectInvite
    this.ProjectInvite = ProjectInvite = (function() {
      ProjectInvite = class ProjectInvite {
        static initClass() {
          this.prototype.save = sinon.stub()
          this.findOne = sinon.stub()
          this.find = sinon.stub()
          this.remove = sinon.stub()
          this.count = sinon.stub()
        }
        constructor(options) {
          if (options == null) {
            options = {}
          }
          this._id = ObjectId()
          for (let k in options) {
            const v = options[k]
            this[k] = v
          }
          this
        }
      }
      ProjectInvite.initClass()
      return ProjectInvite
    })()
    this.Crypto = Crypto
    this.CollaboratorsInviteHandler = SandboxedModule.require(modulePath, {
      globals: {
        console: console
      },
      requires: {
        'settings-sharelatex': (this.settings = {}),
        '../../models/ProjectInvite': { ProjectInvite: this.ProjectInvite },
        'logger-sharelatex': (this.logger = {
          err: sinon.stub(),
          error: sinon.stub(),
          warn: sinon.stub(),
          log: sinon.stub()
        }),
        './CollaboratorsEmailHandler': (this.CollaboratorsEmailHandler = {}),
        './CollaboratorsHandler': (this.CollaboratorsHandler = {
          addUserIdToProject: sinon.stub()
        }),
        '../User/UserGetter': (this.UserGetter = { getUser: sinon.stub() }),
        '../Project/ProjectGetter': (this.ProjectGetter = {}),
        '../Notifications/NotificationsBuilder': (this.NotificationsBuilder = {}),
        crypto: this.Crypto
      }
    })

    this.projectId = ObjectId()
    this.sendingUserId = ObjectId()
    this.sendingUser = {
      _id: this.sendingUserId,
      name: 'Bob'
    }
    this.email = 'user@example.com'
    this.userId = ObjectId()
    this.user = {
      _id: this.userId,
      email: 'someone@example.com'
    }
    this.inviteId = ObjectId()
    this.token = 'hnhteaosuhtaeosuahs'
    this.privileges = 'readAndWrite'
    return (this.fakeInvite = {
      _id: this.inviteId,
      email: this.email,
      token: this.token,
      sendingUserId: this.sendingUserId,
      projectId: this.projectId,
      privileges: this.privileges,
      createdAt: new Date()
    })
  })

  describe('getInviteCount', function() {
    beforeEach(function() {
      this.ProjectInvite.count.callsArgWith(1, null, 2)
      return (this.call = callback => {
        return this.CollaboratorsInviteHandler.getInviteCount(
          this.projectId,
          callback
        )
      })
    })

    it('should not produce an error', function(done) {
      return this.call((err, invites) => {
        expect(err).to.not.be.instanceof(Error)
        expect(err).to.be.oneOf([null, undefined])
        return done()
      })
    })

    it('should produce the count of documents', function(done) {
      return this.call((err, count) => {
        expect(count).to.equal(2)
        return done()
      })
    })

    describe('when model.count produces an error', function() {
      beforeEach(function() {
        return this.ProjectInvite.count.callsArgWith(1, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call((err, count) => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })
  })

  describe('getAllInvites', function() {
    beforeEach(function() {
      this.fakeInvites = [
        { _id: ObjectId(), one: 1 },
        { _id: ObjectId(), two: 2 }
      ]
      this.ProjectInvite.find.callsArgWith(1, null, this.fakeInvites)
      return (this.call = callback => {
        return this.CollaboratorsInviteHandler.getAllInvites(
          this.projectId,
          callback
        )
      })
    })

    describe('when all goes well', function() {
      beforeEach(function() {})

      it('should not produce an error', function(done) {
        return this.call((err, invites) => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.be.oneOf([null, undefined])
          return done()
        })
      })

      it('should produce a list of invite objects', function(done) {
        return this.call((err, invites) => {
          expect(invites).to.not.be.oneOf([null, undefined])
          expect(invites).to.deep.equal(this.fakeInvites)
          return done()
        })
      })

      it('should have called ProjectInvite.find', function(done) {
        return this.call((err, invites) => {
          this.ProjectInvite.find.callCount.should.equal(1)
          this.ProjectInvite.find
            .calledWith({ projectId: this.projectId })
            .should.equal(true)
          return done()
        })
      })
    })

    describe('when ProjectInvite.find produces an error', function() {
      beforeEach(function() {
        return this.ProjectInvite.find.callsArgWith(1, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call((err, invites) => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })
  })

  describe('inviteToProject', function() {
    beforeEach(function() {
      this.ProjectInvite.prototype.save = sinon.spy(function(cb) {
        return cb(null, this)
      })
      this.randomBytesSpy = sinon.spy(this.Crypto, 'randomBytes')
      this.CollaboratorsInviteHandler._sendMessages = sinon
        .stub()
        .callsArgWith(3, null)
      return (this.call = callback => {
        return this.CollaboratorsInviteHandler.inviteToProject(
          this.projectId,
          this.sendingUser,
          this.email,
          this.privileges,
          callback
        )
      })
    })

    afterEach(function() {
      return this.randomBytesSpy.restore()
    })

    describe('when all goes well', function() {
      beforeEach(function() {})

      it('should not produce an error', function(done) {
        return this.call((err, invite) => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.be.oneOf([null, undefined])
          return done()
        })
      })

      it('should produce the invite object', function(done) {
        return this.call((err, invite) => {
          expect(invite).to.not.equal(null)
          expect(invite).to.not.equal(undefined)
          expect(invite).to.be.instanceof(Object)
          expect(invite).to.have.all.keys([
            '_id',
            'email',
            'token',
            'sendingUserId',
            'projectId',
            'privileges'
          ])
          return done()
        })
      })

      it('should have generated a random token', function(done) {
        return this.call((err, invite) => {
          this.randomBytesSpy.callCount.should.equal(1)
          return done()
        })
      })

      it('should have called ProjectInvite.save', function(done) {
        return this.call((err, invite) => {
          this.ProjectInvite.prototype.save.callCount.should.equal(1)
          return done()
        })
      })

      it('should have called _sendMessages', function(done) {
        return this.call((err, invite) => {
          this.CollaboratorsInviteHandler._sendMessages.callCount.should.equal(
            1
          )
          this.CollaboratorsInviteHandler._sendMessages
            .calledWith(this.projectId, this.sendingUser)
            .should.equal(true)
          return done()
        })
      })
    })

    describe('when saving model produces an error', function() {
      beforeEach(function() {
        return (this.ProjectInvite.prototype.save = sinon.spy(function(cb) {
          return cb(new Error('woops'), this)
        }))
      })

      it('should produce an error', function(done) {
        return this.call((err, invite) => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })
  })

  describe('_sendMessages', function() {
    beforeEach(function() {
      this.CollaboratorsEmailHandler.notifyUserOfProjectInvite = sinon
        .stub()
        .callsArgWith(4, null)
      this.CollaboratorsInviteHandler._trySendInviteNotification = sinon
        .stub()
        .callsArgWith(3, null)
      return (this.call = callback => {
        return this.CollaboratorsInviteHandler._sendMessages(
          this.projectId,
          this.sendingUser,
          this.fakeInvite,
          callback
        )
      })
    })

    describe('when all goes well', function() {
      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.be.oneOf([null, undefined])
          return done()
        })
      })

      it('should call CollaboratorsEmailHandler.notifyUserOfProjectInvite', function(done) {
        return this.call(err => {
          this.CollaboratorsEmailHandler.notifyUserOfProjectInvite.callCount.should.equal(
            1
          )
          this.CollaboratorsEmailHandler.notifyUserOfProjectInvite
            .calledWith(this.projectId, this.fakeInvite.email, this.fakeInvite)
            .should.equal(true)
          return done()
        })
      })

      it('should call _trySendInviteNotification', function(done) {
        return this.call(err => {
          this.CollaboratorsInviteHandler._trySendInviteNotification.callCount.should.equal(
            1
          )
          this.CollaboratorsInviteHandler._trySendInviteNotification
            .calledWith(this.projectId, this.sendingUser, this.fakeInvite)
            .should.equal(true)
          return done()
        })
      })
    })

    describe('when CollaboratorsEmailHandler.notifyUserOfProjectInvite produces an error', function() {
      beforeEach(function() {
        return (this.CollaboratorsEmailHandler.notifyUserOfProjectInvite = sinon
          .stub()
          .callsArgWith(4, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.call((err, invite) => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })

      it('should not call _trySendInviteNotification', function(done) {
        return this.call(err => {
          this.CollaboratorsInviteHandler._trySendInviteNotification.callCount.should.equal(
            0
          )
          return done()
        })
      })
    })

    describe('when _trySendInviteNotification produces an error', function() {
      beforeEach(function() {
        return (this.CollaboratorsInviteHandler._trySendInviteNotification = sinon
          .stub()
          .callsArgWith(3, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.call((err, invite) => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })
  })

  describe('revokeInvite', function() {
    beforeEach(function() {
      this.ProjectInvite.remove.callsArgWith(1, null)
      this.CollaboratorsInviteHandler._tryCancelInviteNotification = sinon
        .stub()
        .callsArgWith(1, null)
      return (this.call = callback => {
        return this.CollaboratorsInviteHandler.revokeInvite(
          this.projectId,
          this.inviteId,
          callback
        )
      })
    })

    describe('when all goes well', function() {
      beforeEach(function() {})

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.be.oneOf([null, undefined])
          return done()
        })
      })

      it('should call ProjectInvite.remove', function(done) {
        return this.call(err => {
          this.ProjectInvite.remove.callCount.should.equal(1)
          this.ProjectInvite.remove
            .calledWith({ projectId: this.projectId, _id: this.inviteId })
            .should.equal(true)
          return done()
        })
      })

      it('should call _tryCancelInviteNotification', function(done) {
        return this.call(err => {
          this.CollaboratorsInviteHandler._tryCancelInviteNotification.callCount.should.equal(
            1
          )
          this.CollaboratorsInviteHandler._tryCancelInviteNotification
            .calledWith(this.inviteId)
            .should.equal(true)
          return done()
        })
      })
    })

    describe('when remove produces an error', function() {
      beforeEach(function() {
        return this.ProjectInvite.remove.callsArgWith(1, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })
  })

  describe('resendInvite', function() {
    beforeEach(function() {
      this.ProjectInvite.findOne.callsArgWith(1, null, this.fakeInvite)
      this.CollaboratorsInviteHandler._sendMessages = sinon
        .stub()
        .callsArgWith(3, null)
      return (this.call = callback => {
        return this.CollaboratorsInviteHandler.resendInvite(
          this.projectId,
          this.sendingUser,
          this.inviteId,
          callback
        )
      })
    })

    describe('when all goes well', function() {
      beforeEach(function() {})

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.be.oneOf([null, undefined])
          return done()
        })
      })

      it('should call ProjectInvite.findOne', function(done) {
        return this.call((err, invite) => {
          this.ProjectInvite.findOne.callCount.should.equal(1)
          this.ProjectInvite.findOne
            .calledWith({ _id: this.inviteId, projectId: this.projectId })
            .should.equal(true)
          return done()
        })
      })

      it('should have called _sendMessages', function(done) {
        return this.call((err, invite) => {
          this.CollaboratorsInviteHandler._sendMessages.callCount.should.equal(
            1
          )
          this.CollaboratorsInviteHandler._sendMessages
            .calledWith(this.projectId, this.sendingUser, this.fakeInvite)
            .should.equal(true)
          return done()
        })
      })
    })

    describe('when findOne produces an error', function() {
      beforeEach(function() {
        return this.ProjectInvite.findOne.callsArgWith(1, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call((err, invite) => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })

      it('should not have called _sendMessages', function(done) {
        return this.call((err, invite) => {
          this.CollaboratorsInviteHandler._sendMessages.callCount.should.equal(
            0
          )
          return done()
        })
      })
    })

    describe('when findOne does not find an invite', function() {
      beforeEach(function() {
        return this.ProjectInvite.findOne.callsArgWith(1, null, null)
      })

      it('should not produce an error', function(done) {
        return this.call((err, invite) => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.be.oneOf([null, undefined])
          return done()
        })
      })

      it('should not have called _sendMessages', function(done) {
        return this.call((err, invite) => {
          this.CollaboratorsInviteHandler._sendMessages.callCount.should.equal(
            0
          )
          return done()
        })
      })
    })
  })

  describe('getInviteByToken', function() {
    beforeEach(function() {
      this.ProjectInvite.findOne.callsArgWith(1, null, this.fakeInvite)
      return (this.call = callback => {
        return this.CollaboratorsInviteHandler.getInviteByToken(
          this.projectId,
          this.token,
          callback
        )
      })
    })

    describe('when all goes well', function() {
      beforeEach(function() {})

      it('should not produce an error', function(done) {
        return this.call((err, invite) => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.be.oneOf([null, undefined])
          return done()
        })
      })

      it('should produce the invite object', function(done) {
        return this.call((err, invite) => {
          expect(invite).to.deep.equal(this.fakeInvite)
          return done()
        })
      })

      it('should call ProjectInvite.findOne', function(done) {
        return this.call((err, invite) => {
          this.ProjectInvite.findOne.callCount.should.equal(1)
          this.ProjectInvite.findOne
            .calledWith({ projectId: this.projectId, token: this.token })
            .should.equal(true)
          return done()
        })
      })
    })

    describe('when findOne produces an error', function() {
      beforeEach(function() {
        return this.ProjectInvite.findOne.callsArgWith(1, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call((err, invite) => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })

    describe('when findOne does not find an invite', function() {
      beforeEach(function() {
        return this.ProjectInvite.findOne.callsArgWith(1, null, null)
      })

      it('should not produce an error', function(done) {
        return this.call((err, invite) => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.be.oneOf([null, undefined])
          return done()
        })
      })

      it('should not produce an invite object', function(done) {
        return this.call((err, invite) => {
          expect(invite).to.not.be.instanceof(Error)
          expect(invite).to.be.oneOf([null, undefined])
          return done()
        })
      })
    })
  })

  describe('acceptInvite', function() {
    beforeEach(function() {
      this.fakeProject = {
        _id: this.projectId,
        collaberator_refs: [],
        readOnly_refs: []
      }
      this.CollaboratorsHandler.addUserIdToProject.callsArgWith(4, null)
      this._getInviteByToken = sinon.stub(
        this.CollaboratorsInviteHandler,
        'getInviteByToken'
      )
      this._getInviteByToken.callsArgWith(2, null, this.fakeInvite)
      this.CollaboratorsInviteHandler._tryCancelInviteNotification = sinon
        .stub()
        .callsArgWith(1, null)
      this.ProjectInvite.remove.callsArgWith(1, null)
      return (this.call = callback => {
        return this.CollaboratorsInviteHandler.acceptInvite(
          this.projectId,
          this.token,
          this.user,
          callback
        )
      })
    })

    afterEach(function() {
      return this._getInviteByToken.restore()
    })

    describe('when all goes well', function() {
      beforeEach(function() {})

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.be.oneOf([null, undefined])
          return done()
        })
      })

      it('should have called getInviteByToken', function(done) {
        return this.call(err => {
          this._getInviteByToken.callCount.should.equal(1)
          this._getInviteByToken
            .calledWith(this.projectId, this.token)
            .should.equal(true)
          return done()
        })
      })

      it('should have called CollaboratorsHandler.addUserIdToProject', function(done) {
        return this.call(err => {
          this.CollaboratorsHandler.addUserIdToProject.callCount.should.equal(1)
          this.CollaboratorsHandler.addUserIdToProject
            .calledWith(
              this.projectId,
              this.sendingUserId,
              this.userId,
              this.fakeInvite.privileges
            )
            .should.equal(true)
          return done()
        })
      })

      it('should have called ProjectInvite.remove', function(done) {
        return this.call(err => {
          this.ProjectInvite.remove.callCount.should.equal(1)
          this.ProjectInvite.remove
            .calledWith({ _id: this.inviteId })
            .should.equal(true)
          return done()
        })
      })
    })

    describe('when the invite is for readOnly access', function() {
      beforeEach(function() {
        this.fakeInvite.privileges = 'readOnly'
        return this._getInviteByToken.callsArgWith(2, null, this.fakeInvite)
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.not.be.instanceof(Error)
          expect(err).to.be.oneOf([null, undefined])
          return done()
        })
      })

      it('should have called CollaboratorsHandler.addUserIdToProject', function(done) {
        return this.call(err => {
          this.CollaboratorsHandler.addUserIdToProject.callCount.should.equal(1)
          this.CollaboratorsHandler.addUserIdToProject
            .calledWith(
              this.projectId,
              this.sendingUserId,
              this.userId,
              this.fakeInvite.privileges
            )
            .should.equal(true)
          return done()
        })
      })
    })

    describe('when getInviteByToken does not find an invite', function() {
      beforeEach(function() {
        return this._getInviteByToken.callsArgWith(2, null, null)
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.be.instanceof(Error)
          expect(err.name).to.equal('NotFoundError')
          return done()
        })
      })

      it('should have called getInviteByToken', function(done) {
        return this.call(err => {
          this._getInviteByToken.callCount.should.equal(1)
          this._getInviteByToken
            .calledWith(this.projectId, this.token)
            .should.equal(true)
          return done()
        })
      })

      it('should not have called CollaboratorsHandler.addUserIdToProject', function(done) {
        return this.call(err => {
          this.CollaboratorsHandler.addUserIdToProject.callCount.should.equal(0)
          return done()
        })
      })

      it('should not have called ProjectInvite.remove', function(done) {
        return this.call(err => {
          this.ProjectInvite.remove.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when getInviteByToken produces an error', function() {
      beforeEach(function() {
        return this._getInviteByToken.callsArgWith(2, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })

      it('should have called getInviteByToken', function(done) {
        return this.call(err => {
          this._getInviteByToken.callCount.should.equal(1)
          this._getInviteByToken
            .calledWith(this.projectId, this.token)
            .should.equal(true)
          return done()
        })
      })

      it('should not have called CollaboratorsHandler.addUserIdToProject', function(done) {
        return this.call(err => {
          this.CollaboratorsHandler.addUserIdToProject.callCount.should.equal(0)
          return done()
        })
      })

      it('should not have called ProjectInvite.remove', function(done) {
        return this.call(err => {
          this.ProjectInvite.remove.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when addUserIdToProject produces an error', function() {
      beforeEach(function() {
        return this.CollaboratorsHandler.addUserIdToProject.callsArgWith(
          4,
          new Error('woops')
        )
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })

      it('should have called getInviteByToken', function(done) {
        return this.call(err => {
          this._getInviteByToken.callCount.should.equal(1)
          this._getInviteByToken
            .calledWith(this.projectId, this.token)
            .should.equal(true)
          return done()
        })
      })

      it('should have called CollaboratorsHandler.addUserIdToProject', function(done) {
        return this.call(err => {
          this.CollaboratorsHandler.addUserIdToProject.callCount.should.equal(1)
          this.CollaboratorsHandler.addUserIdToProject
            .calledWith(
              this.projectId,
              this.sendingUserId,
              this.userId,
              this.fakeInvite.privileges
            )
            .should.equal(true)
          return done()
        })
      })

      it('should not have called ProjectInvite.remove', function(done) {
        return this.call(err => {
          this.ProjectInvite.remove.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when ProjectInvite.remove produces an error', function() {
      beforeEach(function() {
        return this.ProjectInvite.remove.callsArgWith(1, new Error('woops'))
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })

      it('should have called getInviteByToken', function(done) {
        return this.call(err => {
          this._getInviteByToken.callCount.should.equal(1)
          this._getInviteByToken
            .calledWith(this.projectId, this.token)
            .should.equal(true)
          return done()
        })
      })

      it('should have called CollaboratorsHandler.addUserIdToProject', function(done) {
        return this.call(err => {
          this.CollaboratorsHandler.addUserIdToProject.callCount.should.equal(1)
          this.CollaboratorsHandler.addUserIdToProject
            .calledWith(
              this.projectId,
              this.sendingUserId,
              this.userId,
              this.fakeInvite.privileges
            )
            .should.equal(true)
          return done()
        })
      })

      it('should have called ProjectInvite.remove', function(done) {
        return this.call(err => {
          this.ProjectInvite.remove.callCount.should.equal(1)
          return done()
        })
      })
    })
  })

  describe('_tryCancelInviteNotification', function() {
    beforeEach(function() {
      this.inviteId = ObjectId()
      this.currentUser = { _id: ObjectId() }
      this.notification = { read: sinon.stub().callsArgWith(0, null) }
      this.NotificationsBuilder.projectInvite = sinon
        .stub()
        .returns(this.notification)
      return (this.call = callback => {
        return this.CollaboratorsInviteHandler._tryCancelInviteNotification(
          this.inviteId,
          callback
        )
      })
    })

    it('should not produce an error', function(done) {
      return this.call(err => {
        expect(err).to.be.oneOf([null, undefined])
        return done()
      })
    })

    it('should call notification.read', function(done) {
      return this.call(err => {
        this.notification.read.callCount.should.equal(1)
        return done()
      })
    })

    describe('when notification.read produces an error', function() {
      beforeEach(function() {
        this.notification = {
          read: sinon.stub().callsArgWith(0, new Error('woops'))
        }
        return (this.NotificationsBuilder.projectInvite = sinon
          .stub()
          .returns(this.notification))
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })
    })
  })

  describe('_trySendInviteNotification', function() {
    beforeEach(function() {
      this.invite = {
        _id: ObjectId(),
        token: 'some_token',
        sendingUserId: ObjectId(),
        projectId: this.project_id,
        targetEmail: 'user@example.com',
        createdAt: new Date()
      }
      this.sendingUser = {
        _id: ObjectId(),
        first_name: 'jim'
      }
      this.existingUser = { _id: ObjectId() }
      this.UserGetter.getUserByAnyEmail = sinon
        .stub()
        .callsArgWith(2, null, this.existingUser)
      this.fakeProject = {
        _id: this.project_id,
        name: 'some project'
      }
      this.ProjectGetter.getProject = sinon
        .stub()
        .callsArgWith(2, null, this.fakeProject)
      this.notification = { create: sinon.stub().callsArgWith(0, null) }
      this.NotificationsBuilder.projectInvite = sinon
        .stub()
        .returns(this.notification)
      return (this.call = callback => {
        return this.CollaboratorsInviteHandler._trySendInviteNotification(
          this.project_id,
          this.sendingUser,
          this.invite,
          callback
        )
      })
    })

    describe('when the user exists', function() {
      beforeEach(function() {})

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.be.oneOf([null, undefined])
          return done()
        })
      })

      it('should call getUser', function(done) {
        return this.call(err => {
          this.UserGetter.getUserByAnyEmail.callCount.should.equal(1)
          this.UserGetter.getUserByAnyEmail
            .calledWith(this.invite.email)
            .should.equal(true)
          return done()
        })
      })

      it('should call getProject', function(done) {
        return this.call(err => {
          this.ProjectGetter.getProject.callCount.should.equal(1)
          this.ProjectGetter.getProject
            .calledWith(this.project_id)
            .should.equal(true)
          return done()
        })
      })

      it('should call NotificationsBuilder.projectInvite.create', function(done) {
        return this.call(err => {
          this.NotificationsBuilder.projectInvite.callCount.should.equal(1)
          this.notification.create.callCount.should.equal(1)
          return done()
        })
      })

      describe('when getProject produces an error', function() {
        beforeEach(function() {
          return this.ProjectGetter.getProject.callsArgWith(
            2,
            new Error('woops')
          )
        })

        it('should produce an error', function(done) {
          return this.call(err => {
            expect(err).to.be.instanceof(Error)
            return done()
          })
        })

        it('should not call NotificationsBuilder.projectInvite.create', function(done) {
          return this.call(err => {
            this.NotificationsBuilder.projectInvite.callCount.should.equal(0)
            this.notification.create.callCount.should.equal(0)
            return done()
          })
        })
      })

      describe('when projectInvite.create produces an error', function() {
        beforeEach(function() {
          return this.notification.create.callsArgWith(0, new Error('woops'))
        })

        it('should produce an error', function(done) {
          return this.call(err => {
            expect(err).to.be.instanceof(Error)
            return done()
          })
        })
      })
    })

    describe('when the user does not exist', function() {
      beforeEach(function() {
        return (this.UserGetter.getUserByAnyEmail = sinon
          .stub()
          .callsArgWith(2, null, null))
      })

      it('should not produce an error', function(done) {
        return this.call(err => {
          expect(err).to.be.oneOf([null, undefined])
          return done()
        })
      })

      it('should call getUser', function(done) {
        return this.call(err => {
          this.UserGetter.getUserByAnyEmail.callCount.should.equal(1)
          this.UserGetter.getUserByAnyEmail
            .calledWith(this.invite.email)
            .should.equal(true)
          return done()
        })
      })

      it('should not call getProject', function(done) {
        return this.call(err => {
          this.ProjectGetter.getProject.callCount.should.equal(0)
          return done()
        })
      })

      it('should not call NotificationsBuilder.projectInvite.create', function(done) {
        return this.call(err => {
          this.NotificationsBuilder.projectInvite.callCount.should.equal(0)
          this.notification.create.callCount.should.equal(0)
          return done()
        })
      })
    })

    describe('when the getUser produces an error', function() {
      beforeEach(function() {
        return (this.UserGetter.getUserByAnyEmail = sinon
          .stub()
          .callsArgWith(2, new Error('woops')))
      })

      it('should produce an error', function(done) {
        return this.call(err => {
          expect(err).to.be.instanceof(Error)
          return done()
        })
      })

      it('should call getUser', function(done) {
        return this.call(err => {
          this.UserGetter.getUserByAnyEmail.callCount.should.equal(1)
          this.UserGetter.getUserByAnyEmail
            .calledWith(this.invite.email)
            .should.equal(true)
          return done()
        })
      })

      it('should not call getProject', function(done) {
        return this.call(err => {
          this.ProjectGetter.getProject.callCount.should.equal(0)
          return done()
        })
      })

      it('should not call NotificationsBuilder.projectInvite.create', function(done) {
        return this.call(err => {
          this.NotificationsBuilder.projectInvite.callCount.should.equal(0)
          this.notification.create.callCount.should.equal(0)
          return done()
        })
      })
    })
  })
})

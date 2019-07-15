/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const assertCalledWith = sinon.assert.calledWith
const assertNotCalled = sinon.assert.notCalled
const chai = require('chai')
const should = chai.should()
const { assert } = chai
const { expect } = require('chai')
const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipController.js'
const SandboxedModule = require('sandboxed-module')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const EntityConfigs = require('../../../../app/src/Features/UserMembership/UserMembershipEntityConfigs')
const Errors = require('../../../../app/src/Features/Errors/Errors')

describe('UserMembershipController', function() {
  beforeEach(function() {
    this.req = new MockRequest()
    this.req.params.id = 'mock-entity-id'
    this.user = { _id: 'mock-user-id' }
    this.newUser = { _id: 'mock-new-user-id', email: 'new-user-email@foo.bar' }
    this.subscription = {
      _id: 'mock-subscription-id',
      fetchV1Data: callback => callback(null, this.subscription)
    }
    this.institution = {
      _id: 'mock-institution-id',
      v1Id: 123,
      fetchV1Data: callback => {
        const institution = Object.assign({}, this.institution)
        institution.name = 'Test Institution Name'
        return callback(null, institution)
      }
    }
    this.users = [
      { _id: 'mock-member-id-1', email: 'mock-email-1@foo.com' },
      { _id: 'mock-member-id-2', email: 'mock-email-2@foo.com' }
    ]

    this.AuthenticationController = {
      getSessionUser: sinon.stub().returns(this.user),
      getLoggedInUserId: sinon.stub().returns(this.user._id)
    }
    this.UserMembershipHandler = {
      getEntity: sinon.stub().yields(null, this.subscription),
      createEntity: sinon.stub().yields(null, this.institution),
      getUsers: sinon.stub().yields(null, this.users),
      addUser: sinon.stub().yields(null, this.newUser),
      removeUser: sinon.stub().yields(null)
    }
    return (this.UserMembershipController = SandboxedModule.require(
      modulePath,
      {
        globals: {
          console: console
        },
        requires: {
          '../Authentication/AuthenticationController': this
            .AuthenticationController,
          './UserMembershipHandler': this.UserMembershipHandler,
          '../Errors/Errors': Errors,
          'logger-sharelatex': {
            log() {},
            err() {}
          }
        }
      }
    ))
  })

  describe('index', function() {
    beforeEach(function() {
      this.req.entity = this.subscription
      return (this.req.entityConfig = EntityConfigs.group)
    })

    it('get users', function(done) {
      return this.UserMembershipController.index(this.req, {
        render: () => {
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.getUsers,
            this.subscription,
            { modelName: 'Subscription' }
          )
          return done()
        }
      })
    })

    it('render group view', function(done) {
      return this.UserMembershipController.index(this.req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal('user_membership/index')
          expect(viewParams.users).to.deep.equal(this.users)
          expect(viewParams.groupSize).to.equal(this.subscription.membersLimit)
          expect(viewParams.translations.title).to.equal('group_account')
          expect(viewParams.paths.addMember).to.equal(
            `/manage/groups/${this.subscription._id}/invites`
          )
          return done()
        }
      })
    })

    it('render group managers view', function(done) {
      this.req.entityConfig = EntityConfigs.groupManagers
      return this.UserMembershipController.index(this.req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal('user_membership/index')
          expect(viewParams.groupSize).to.equal(undefined)
          expect(viewParams.translations.title).to.equal('group_account')
          expect(viewParams.translations.subtitle).to.equal(
            'managers_management'
          )
          expect(viewParams.paths.exportMembers).to.be.undefined
          return done()
        }
      })
    })

    it('render institution view', function(done) {
      this.req.entity = this.institution
      this.req.entityConfig = EntityConfigs.institution
      return this.UserMembershipController.index(this.req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal('user_membership/index')
          expect(viewParams.name).to.equal('Test Institution Name')
          expect(viewParams.groupSize).to.equal(undefined)
          expect(viewParams.translations.title).to.equal('institution_account')
          expect(viewParams.paths.exportMembers).to.be.undefined
          return done()
        }
      })
    })
  })

  describe('add', function() {
    beforeEach(function() {
      this.req.body.email = this.newUser.email
      this.req.entity = this.subscription
      return (this.req.entityConfig = EntityConfigs.groupManagers)
    })

    it('add user', function(done) {
      return this.UserMembershipController.add(this.req, {
        json: () => {
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.addUser,
            this.subscription,
            { modelName: 'Subscription' },
            this.newUser.email
          )
          return done()
        }
      })
    })

    it('return user object', function(done) {
      return this.UserMembershipController.add(this.req, {
        json: payload => {
          payload.user.should.equal(this.newUser)
          return done()
        }
      })
    })

    it('handle readOnly entity', function(done) {
      this.req.entityConfig = EntityConfigs.group
      return this.UserMembershipController.add(this.req, null, error => {
        expect(error).to.extist
        expect(error).to.be.an.instanceof(Errors.NotFoundError)
        return done()
      })
    })

    it('handle user already added', function(done) {
      this.UserMembershipHandler.addUser.yields({ alreadyAdded: true })
      return this.UserMembershipController.add(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('user_already_added')
            return done()
          }
        })
      })
    })

    it('handle user not found', function(done) {
      this.UserMembershipHandler.addUser.yields({ userNotFound: true })
      return this.UserMembershipController.add(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('user_not_found')
            return done()
          }
        })
      })
    })

    it('handle invalid email', function(done) {
      this.req.body.email = 'not_valid_email'
      return this.UserMembershipController.add(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('invalid_email')
            return done()
          }
        })
      })
    })
  })

  describe('remove', function() {
    beforeEach(function() {
      this.req.params.userId = this.newUser._id
      this.req.entity = this.subscription
      return (this.req.entityConfig = EntityConfigs.groupManagers)
    })

    it('remove user', function(done) {
      return this.UserMembershipController.remove(this.req, {
        send: () => {
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.removeUser,
            this.subscription,
            { modelName: 'Subscription' },
            this.newUser._id
          )
          return done()
        }
      })
    })

    it('handle readOnly entity', function(done) {
      this.req.entityConfig = EntityConfigs.group
      return this.UserMembershipController.remove(this.req, null, error => {
        expect(error).to.extist
        expect(error).to.be.an.instanceof(Errors.NotFoundError)
        return done()
      })
    })

    it('prevent self removal', function(done) {
      this.req.params.userId = this.user._id
      return this.UserMembershipController.remove(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('managers_cannot_remove_self')
            return done()
          }
        })
      })
    })

    it('prevent admin removal', function(done) {
      this.UserMembershipHandler.removeUser.yields({ isAdmin: true })
      return this.UserMembershipController.remove(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('managers_cannot_remove_admin')
            return done()
          }
        })
      })
    })
  })

  describe('exportCsv', function() {
    beforeEach(function() {
      this.req.entity = this.subscription
      this.req.entityConfig = EntityConfigs.groupManagers
      this.res = new MockResponse()
      this.res.contentType = sinon.stub()
      this.res.header = sinon.stub()
      this.res.send = sinon.stub()
      return this.UserMembershipController.exportCsv(this.req, this.res)
    })

    it('get users', function() {
      return sinon.assert.calledWithMatch(
        this.UserMembershipHandler.getUsers,
        this.subscription,
        { modelName: 'Subscription' }
      )
    })

    it('should set the correct content type on the request', function() {
      return assertCalledWith(this.res.contentType, 'text/csv')
    })

    it('should name the exported csv file', function() {
      return assertCalledWith(
        this.res.header,
        'Content-Disposition',
        'attachment; filename=Group.csv'
      )
    })

    it('should export the correct csv', function() {
      return assertCalledWith(
        this.res.send,
        'mock-email-1@foo.com\nmock-email-2@foo.com\n'
      )
    })
  })

  describe('new', function() {
    beforeEach(function() {
      this.req.params.name = 'publisher'
      return (this.req.params.id = 'abc')
    })

    it('renders view', function(done) {
      return this.UserMembershipController.new(this.req, {
        render: (viewPath, data) => {
          expect(data.entityName).to.eq('publisher')
          expect(data.entityId).to.eq('abc')
          return done()
        }
      })
    })
  })

  describe('create', function() {
    beforeEach(function() {
      this.req.params.name = 'institution'
      return (this.req.params.id = 123)
    })

    it('creates institution', function(done) {
      return this.UserMembershipController.create(this.req, {
        redirect: path => {
          expect(path).to.eq(EntityConfigs['institution'].pathsFor(123).index)
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.createEntity,
            123,
            { modelName: 'Institution' }
          )
          return done()
        }
      })
    })

    it('checks canCreate', function(done) {
      this.req.params.name = 'group'
      return this.UserMembershipController.create(this.req, null, error => {
        expect(error).to.extist
        expect(error).to.be.an.instanceof(Errors.NotFoundError)
        sinon.assert.notCalled(this.UserMembershipHandler.createEntity)
        return done()
      })
    })
  })
})

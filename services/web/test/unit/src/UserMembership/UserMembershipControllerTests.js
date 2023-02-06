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
const { assert, expect } = require('chai')
const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipController.js'
const SandboxedModule = require('sandboxed-module')
const MockRequest = require('../helpers/MockRequest')
const MockResponse = require('../helpers/MockResponse')
const EntityConfigs = require('../../../../app/src/Features/UserMembership/UserMembershipEntityConfigs')
const Errors = require('../../../../app/src/Features/Errors/Errors')
const {
  UserIsManagerError,
} = require('../../../../app/src/Features/UserMembership/UserMembershipErrors')

describe('UserMembershipController', function () {
  beforeEach(function () {
    this.req = new MockRequest()
    this.req.params.id = 'mock-entity-id'
    this.user = { _id: 'mock-user-id' }
    this.newUser = { _id: 'mock-new-user-id', email: 'new-user-email@foo.bar' }
    this.subscription = {
      _id: 'mock-subscription-id',
      fetchV1Data: callback => callback(null, this.subscription),
    }
    this.institution = {
      _id: 'mock-institution-id',
      v1Id: 123,
      fetchV1Data: callback => {
        const institution = Object.assign({}, this.institution)
        institution.name = 'Test Institution Name'
        return callback(null, institution)
      },
    }
    this.users = [
      {
        _id: 'mock-member-id-1',
        email: 'mock-email-1@foo.com',
        last_logged_in_at: '2020-08-09T12:43:11.467Z',
        last_active_at: '2021-08-09T12:43:11.467Z',
      },
      {
        _id: 'mock-member-id-2',
        email: 'mock-email-2@foo.com',
        last_logged_in_at: '2020-05-20T10:41:11.407Z',
        last_active_at: '2021-05-20T10:41:11.407Z',
      },
    ]

    this.SessionManager = {
      getSessionUser: sinon.stub().returns(this.user),
      getLoggedInUserId: sinon.stub().returns(this.user._id),
    }
    this.UserMembershipHandler = {
      getEntity: sinon.stub().yields(null, this.subscription),
      createEntity: sinon.stub().yields(null, this.institution),
      getUsers: sinon.stub().yields(null, this.users),
      addUser: sinon.stub().yields(null, this.newUser),
      removeUser: sinon.stub().yields(null),
    }
    this.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().resolves({ variant: 'default' }),
      },
      getAssignment: sinon.stub().yields(null, { variant: 'default' }),
    }
    return (this.UserMembershipController = SandboxedModule.require(
      modulePath,
      {
        requires: {
          './UserMembershipErrors': { UserIsManagerError },
          '../Authentication/SessionManager': this.SessionManager,
          '../SplitTests/SplitTestHandler': this.SplitTestHandler,
          './UserMembershipHandler': this.UserMembershipHandler,
        },
      }
    ))
  })

  describe('index', function () {
    beforeEach(function () {
      this.req.entity = this.subscription
      return (this.req.entityConfig = EntityConfigs.group)
    })

    it('get users', async function () {
      return await this.UserMembershipController.manageGroupMembers(this.req, {
        render: () => {
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.getUsers,
            this.subscription,
            { modelName: 'Subscription' }
          )
        },
      })
    })

    it('render group view', async function () {
      return await this.UserMembershipController.manageGroupMembers(this.req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal('user_membership/index')
          expect(viewParams.users).to.deep.equal(this.users)
          expect(viewParams.groupSize).to.equal(this.subscription.membersLimit)
          expect(viewParams.translations.title).to.equal('group_subscription')
          expect(viewParams.paths.addMember).to.equal(
            `/manage/groups/${this.subscription._id}/invites`
          )
        },
      })
    })

    it('render group managers view', async function () {
      this.req.entityConfig = EntityConfigs.groupManagers
      return await this.UserMembershipController.manageGroupManagers(this.req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal('user_membership/index')
          expect(viewParams.groupSize).to.equal(undefined)
          expect(viewParams.translations.title).to.equal('group_subscription')
          expect(viewParams.translations.subtitle).to.equal(
            'managers_management'
          )
          expect(viewParams.paths.exportMembers).to.be.undefined
        },
      })
    })

    it('render institution view', async function () {
      this.req.entity = this.institution
      this.req.entityConfig = EntityConfigs.institution
      return await this.UserMembershipController.manageInstitutionManagers(
        this.req,
        {
          render: (viewPath, viewParams) => {
            expect(viewPath).to.equal('user_membership/index')
            expect(viewParams.name).to.equal('Test Institution Name')
            expect(viewParams.groupSize).to.equal(undefined)
            expect(viewParams.translations.title).to.equal(
              'institution_account'
            )
            expect(viewParams.paths.exportMembers).to.be.undefined
          },
        }
      )
    })
  })

  describe('add', function () {
    beforeEach(function () {
      this.req.body.email = this.newUser.email
      this.req.entity = this.subscription
      return (this.req.entityConfig = EntityConfigs.groupManagers)
    })

    it('add user', function (done) {
      return this.UserMembershipController.add(this.req, {
        json: () => {
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.addUser,
            this.subscription,
            { modelName: 'Subscription' },
            this.newUser.email
          )
          return done()
        },
      })
    })

    it('return user object', function (done) {
      return this.UserMembershipController.add(this.req, {
        json: payload => {
          payload.user.should.equal(this.newUser)
          return done()
        },
      })
    })

    it('handle readOnly entity', function (done) {
      this.req.entityConfig = EntityConfigs.group
      return this.UserMembershipController.add(this.req, null, error => {
        expect(error).to.exist
        expect(error).to.be.an.instanceof(Errors.NotFoundError)
        return done()
      })
    })

    it('handle user already added', function (done) {
      this.UserMembershipHandler.addUser.yields({ alreadyAdded: true })
      return this.UserMembershipController.add(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('user_already_added')
            return done()
          },
        }),
      })
    })

    it('handle user not found', function (done) {
      this.UserMembershipHandler.addUser.yields({ userNotFound: true })
      return this.UserMembershipController.add(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('user_not_found')
            return done()
          },
        }),
      })
    })

    it('handle invalid email', function (done) {
      this.req.body.email = 'not_valid_email'
      return this.UserMembershipController.add(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('invalid_email')
            return done()
          },
        }),
      })
    })
  })

  describe('remove', function () {
    beforeEach(function () {
      this.req.params.userId = this.newUser._id
      this.req.entity = this.subscription
      return (this.req.entityConfig = EntityConfigs.groupManagers)
    })

    it('remove user', function (done) {
      return this.UserMembershipController.remove(this.req, {
        sendStatus: () => {
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.removeUser,
            this.subscription,
            { modelName: 'Subscription' },
            this.newUser._id
          )
          return done()
        },
      })
    })

    it('handle readOnly entity', function (done) {
      this.req.entityConfig = EntityConfigs.group
      return this.UserMembershipController.remove(this.req, null, error => {
        expect(error).to.exist
        expect(error).to.be.an.instanceof(Errors.NotFoundError)
        return done()
      })
    })

    it('prevent self removal', function (done) {
      this.req.params.userId = this.user._id
      return this.UserMembershipController.remove(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('managers_cannot_remove_self')
            return done()
          },
        }),
      })
    })

    it('prevent admin removal', function (done) {
      this.UserMembershipHandler.removeUser.yields(new UserIsManagerError())
      return this.UserMembershipController.remove(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('managers_cannot_remove_admin')
            return done()
          },
        }),
      })
    })
  })

  describe('exportCsv', function () {
    beforeEach(function () {
      this.req.entity = this.subscription
      this.req.entityConfig = EntityConfigs.groupManagers
      this.res = new MockResponse()
      return this.UserMembershipController.exportCsv(this.req, this.res)
    })

    it('get users', function () {
      return sinon.assert.calledWithMatch(
        this.UserMembershipHandler.getUsers,
        this.subscription,
        { modelName: 'Subscription' }
      )
    })

    it('should set the correct content type on the request', function () {
      return assertCalledWith(this.res.contentType, 'text/csv; charset=utf-8')
    })

    it('should name the exported csv file', function () {
      return assertCalledWith(
        this.res.header,
        'Content-Disposition',
        'attachment; filename="Group.csv"'
      )
    })

    it('should export the correct csv', function () {
      return assertCalledWith(
        this.res.send,
        '"email","last_logged_in_at","last_active_at"\n"mock-email-1@foo.com","2020-08-09T12:43:11.467Z","2021-08-09T12:43:11.467Z"\n"mock-email-2@foo.com","2020-05-20T10:41:11.407Z","2021-05-20T10:41:11.407Z"'
      )
    })
  })

  describe('new', function () {
    beforeEach(function () {
      this.req.params.name = 'publisher'
      return (this.req.params.id = 'abc')
    })

    it('renders view', function (done) {
      return this.UserMembershipController.new(this.req, {
        render: (viewPath, data) => {
          expect(data.entityName).to.eq('publisher')
          expect(data.entityId).to.eq('abc')
          return done()
        },
      })
    })
  })

  describe('create', function () {
    beforeEach(function () {
      this.req.params.name = 'institution'
      this.req.entityConfig = EntityConfigs.institution
      return (this.req.params.id = 123)
    })

    it('creates institution', function (done) {
      return this.UserMembershipController.create(this.req, {
        redirect: path => {
          expect(path).to.eq(EntityConfigs.institution.pathsFor(123).index)
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.createEntity,
            123,
            { modelName: 'Institution' }
          )
          return done()
        },
      })
    })
  })
})

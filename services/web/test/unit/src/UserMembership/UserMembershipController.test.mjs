import sinon from 'sinon'
import { expect } from 'chai'
import esmock from 'esmock'
import MockRequest from '../helpers/MockRequest.js'
import MockResponse from '../helpers/MockResponse.js'
import EntityConfigs from '../../../../app/src/Features/UserMembership/UserMembershipEntityConfigs.js'
import Errors from '../../../../app/src/Features/Errors/Errors.js'
import {
  UserIsManagerError,
  UserNotFoundError,
  UserAlreadyAddedError,
} from '../../../../app/src/Features/UserMembership/UserMembershipErrors.js'
const assertCalledWith = sinon.assert.calledWith

const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipController.mjs'

describe('UserMembershipController', function () {
  beforeEach(async function () {
    this.req = new MockRequest()
    this.req.params.id = 'mock-entity-id'
    this.user = { _id: 'mock-user-id' }
    this.newUser = { _id: 'mock-new-user-id', email: 'new-user-email@foo.bar' }
    this.subscription = {
      _id: 'mock-subscription-id',
      admin_id: 'mock-admin-id',
      fetchV1Data: callback => callback(null, this.subscription),
    }
    this.institution = {
      _id: 'mock-institution-id',
      v1Id: 123,
      fetchV1Data: callback => {
        const institution = Object.assign({}, this.institution)
        institution.name = 'Test Institution Name'
        callback(null, institution)
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

    this.Settings = {
      managedUsers: {
        enabled: false,
      },
    }

    this.SessionManager = {
      getSessionUser: sinon.stub().returns(this.user),
      getLoggedInUserId: sinon.stub().returns(this.user._id),
    }
    this.SSOConfig = {
      findById: sinon
        .stub()
        .returns({ exec: sinon.stub().resolves({ enabled: true }) }),
    }
    this.UserMembershipHandler = {
      getEntity: sinon.stub().yields(null, this.subscription),
      createEntity: sinon.stub().yields(null, this.institution),
      getUsers: sinon.stub().yields(null, this.users),
      addUser: sinon.stub().yields(null, this.newUser),
      removeUser: sinon.stub().yields(null),
      promises: {
        getUsers: sinon.stub().resolves(this.users),
      },
    }
    this.SplitTestHandler = {
      promises: {
        getAssignment: sinon.stub().resolves({ variant: 'default' }),
      },
      getAssignment: sinon.stub().yields(null, { variant: 'default' }),
    }
    this.RecurlyClient = {
      promises: {
        getSubscription: sinon.stub().resolves({}),
      },
    }
    this.UserMembershipController = await esmock.strict(modulePath, {
      '../../../../app/src/Features/UserMembership/UserMembershipErrors': {
        UserIsManagerError,
        UserNotFoundError,
        UserAlreadyAddedError,
      },
      '../../../../app/src/Features/Authentication/SessionManager':
        this.SessionManager,
      '../../../../app/src/Features/SplitTests/SplitTestHandler':
        this.SplitTestHandler,
      '../../../../app/src/Features/UserMembership/UserMembershipHandler':
        this.UserMembershipHandler,
      '../../../../app/src/Features/Subscription/RecurlyClient':
        this.RecurlyClient,
      '@overleaf/settings': this.Settings,
      '../../../../app/src/models/SSOConfig': { SSOConfig: this.SSOConfig },
    })
  })

  describe('index', function () {
    beforeEach(function () {
      this.req.entity = this.subscription
      this.req.entityConfig = EntityConfigs.group
    })

    it('get users', async function () {
      await this.UserMembershipController.manageGroupMembers(this.req, {
        render: () => {
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.promises.getUsers,
            this.subscription,
            { modelName: 'Subscription' }
          )
        },
      })
    })

    it('render group view', async function () {
      this.subscription.managedUsersEnabled = false
      await this.UserMembershipController.manageGroupMembers(this.req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal('user_membership/group-members-react')
          expect(viewParams.users).to.deep.equal(this.users)
          expect(viewParams.groupSize).to.equal(this.subscription.membersLimit)
          expect(viewParams.managedUsersActive).to.equal(false)
        },
      })
    })

    it('render group view with managed users', async function () {
      this.subscription.managedUsersEnabled = true
      await this.UserMembershipController.manageGroupMembers(this.req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal('user_membership/group-members-react')
          expect(viewParams.users).to.deep.equal(this.users)
          expect(viewParams.groupSize).to.equal(this.subscription.membersLimit)
          expect(viewParams.managedUsersActive).to.equal(true)
        },
      })
    })

    it('render group managers view', async function () {
      this.req.entityConfig = EntityConfigs.groupManagers
      await this.UserMembershipController.manageGroupManagers(this.req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal('user_membership/group-managers-react')
          expect(viewParams.groupSize).to.equal(undefined)
        },
      })
    })

    it('render institution view', async function () {
      this.req.entity = this.institution
      this.req.entityConfig = EntityConfigs.institution
      await this.UserMembershipController.manageInstitutionManagers(this.req, {
        render: (viewPath, viewParams) => {
          expect(viewPath).to.equal(
            'user_membership/institution-managers-react'
          )
          expect(viewParams.name).to.equal('Test Institution Name')
          expect(viewParams.groupSize).to.equal(undefined)
        },
      })
    })
  })

  describe('add', function () {
    beforeEach(function () {
      this.req.body.email = this.newUser.email
      this.req.entity = this.subscription
      this.req.entityConfig = EntityConfigs.groupManagers
    })

    it('add user', function (done) {
      this.UserMembershipController.add(this.req, {
        json: () => {
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.addUser,
            this.subscription,
            { modelName: 'Subscription' },
            this.newUser.email
          )
          done()
        },
      })
    })

    it('return user object', function (done) {
      this.UserMembershipController.add(this.req, {
        json: payload => {
          payload.user.should.equal(this.newUser)
          done()
        },
      })
    })

    it('handle readOnly entity', function (done) {
      this.req.entityConfig = EntityConfigs.group
      this.UserMembershipController.add(this.req, null, error => {
        expect(error).to.exist
        expect(error).to.be.an.instanceof(Errors.NotFoundError)
        done()
      })
    })

    it('handle user already added', function (done) {
      this.UserMembershipHandler.addUser.yields(new UserAlreadyAddedError())
      this.UserMembershipController.add(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('user_already_added')
            done()
          },
        }),
      })
    })

    it('handle user not found', function (done) {
      this.UserMembershipHandler.addUser.yields(new UserNotFoundError())
      this.UserMembershipController.add(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('user_not_found')
            done()
          },
        }),
      })
    })

    it('handle invalid email', function (done) {
      this.req.body.email = 'not_valid_email'
      this.UserMembershipController.add(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('invalid_email')
            done()
          },
        }),
      })
    })
  })

  describe('remove', function () {
    beforeEach(function () {
      this.req.params.userId = this.newUser._id
      this.req.entity = this.subscription
      this.req.entityConfig = EntityConfigs.groupManagers
    })

    it('remove user', function (done) {
      this.UserMembershipController.remove(this.req, {
        sendStatus: () => {
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.removeUser,
            this.subscription,
            { modelName: 'Subscription' },
            this.newUser._id
          )
          done()
        },
      })
    })

    it('handle readOnly entity', function (done) {
      this.req.entityConfig = EntityConfigs.group
      this.UserMembershipController.remove(this.req, null, error => {
        expect(error).to.exist
        expect(error).to.be.an.instanceof(Errors.NotFoundError)
        done()
      })
    })

    it('prevent self removal', function (done) {
      this.req.params.userId = this.user._id
      this.UserMembershipController.remove(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('managers_cannot_remove_self')
            done()
          },
        }),
      })
    })

    it('prevent admin removal', function (done) {
      this.UserMembershipHandler.removeUser.yields(new UserIsManagerError())
      this.UserMembershipController.remove(this.req, {
        status: () => ({
          json: payload => {
            expect(payload.error.code).to.equal('managers_cannot_remove_admin')
            done()
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
      this.UserMembershipController.exportCsv(this.req, this.res)
    })

    it('get users', function () {
      sinon.assert.calledWithMatch(
        this.UserMembershipHandler.getUsers,
        this.subscription,
        { modelName: 'Subscription' }
      )
    })

    it('should set the correct content type on the request', function () {
      assertCalledWith(this.res.contentType, 'text/csv; charset=utf-8')
    })

    it('should name the exported csv file', function () {
      assertCalledWith(
        this.res.header,
        'Content-Disposition',
        'attachment; filename="Group.csv"'
      )
    })

    it('should export the correct csv', function () {
      assertCalledWith(
        this.res.send,
        '"email","last_logged_in_at","last_active_at"\n"mock-email-1@foo.com","2020-08-09T12:43:11.467Z","2021-08-09T12:43:11.467Z"\n"mock-email-2@foo.com","2020-05-20T10:41:11.407Z","2021-05-20T10:41:11.407Z"'
      )
    })
  })

  describe('new', function () {
    beforeEach(function () {
      this.req.params.name = 'publisher'
      this.req.params.id = 'abc'
    })

    it('renders view', function (done) {
      this.UserMembershipController.new(this.req, {
        render: (viewPath, data) => {
          expect(data.entityName).to.eq('publisher')
          expect(data.entityId).to.eq('abc')
          done()
        },
      })
    })
  })

  describe('create', function () {
    beforeEach(function () {
      this.req.params.name = 'institution'
      this.req.entityConfig = EntityConfigs.institution
      this.req.params.id = 123
    })

    it('creates institution', function (done) {
      this.UserMembershipController.create(this.req, {
        redirect: path => {
          expect(path).to.eq(EntityConfigs.institution.pathsFor(123).index)
          sinon.assert.calledWithMatch(
            this.UserMembershipHandler.createEntity,
            123,
            { modelName: 'Institution' }
          )
          done()
        },
      })
    })
  })
})

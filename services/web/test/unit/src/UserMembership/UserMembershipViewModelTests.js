const { expect } = require('chai')
const sinon = require('sinon')
const assertCalledWith = sinon.assert.calledWith
const assertNotCalled = sinon.assert.notCalled
const { ObjectId } = require('mongodb-legacy')
const modulePath =
  '../../../../app/src/Features/UserMembership/UserMembershipViewModel'
const SandboxedModule = require('sandboxed-module')
const {
  isObjectIdInstance,
  normalizeQuery,
} = require('../../../../app/src/Features/Helpers/Mongo')

describe('UserMembershipViewModel', function () {
  beforeEach(function () {
    this.UserGetter = { promises: { getUsers: sinon.stub() } }
    this.UserMembershipViewModel = SandboxedModule.require(modulePath, {
      requires: {
        'mongodb-legacy': { ObjectId },
        '../Helpers/Mongo': { isObjectIdInstance, normalizeQuery },
        '../User/UserGetter': this.UserGetter,
      },
    })
    this.email = 'mock-email@bar.com'
    this.user = {
      _id: 'mock-user-id',
      email: 'mock-email@baz.com',
      first_name: 'Name',
      lastLoggedIn: '2020-05-20T10:41:11.407Z',
      enrollment: {
        managedBy: 'mock-group-id',
        enrolledAt: new Date(),
        sso: {
          groupId: 'abc123abc123',
          linkedAt: new Date(),
          primary: true,
        },
      },
    }
  })

  describe('build', function () {
    it('build email', function () {
      const viewModel = this.UserMembershipViewModel.build(this.email)
      expect(viewModel).to.deep.equal({
        email: this.email,
        invite: true,
        last_active_at: null,
        last_logged_in_at: null,
        first_name: null,
        last_name: null,
        _id: null,
        enrollment: undefined,
      })
    })

    it('build user', function () {
      const viewModel = this.UserMembershipViewModel.build(this.user)
      expect(viewModel).to.deep.equal({
        email: this.user.email,
        invite: false,
        last_active_at: this.user.lastLoggedIn,
        last_logged_in_at: this.user.lastLoggedIn,
        first_name: this.user.first_name,
        last_name: null,
        _id: this.user._id,
        enrollment: this.user.enrollment,
      })
    })
  })

  describe('build async', function () {
    beforeEach(function () {
      this.UserMembershipViewModel.build = sinon.stub()
    })

    it('build email', async function () {
      this.UserGetter.promises.getUsers.resolves([])
      await this.UserMembershipViewModel.buildAsync([this.email])
      assertCalledWith(this.UserMembershipViewModel.build, this.email)
    })

    it('build user', async function () {
      this.UserGetter.promises.getUsers.resolves([])
      await this.UserMembershipViewModel.buildAsync([this.user])
      assertCalledWith(this.UserMembershipViewModel.build, this.user)
    })

    it('build user id', async function () {
      const user = {
        ...this.user,
        _id: new ObjectId(),
      }
      this.UserGetter.promises.getUsers.resolves([user])
      const [viewModel] = await this.UserMembershipViewModel.buildAsync([
        user._id,
      ])
      assertNotCalled(this.UserMembershipViewModel.build)
      expect(viewModel._id.toString()).to.equal(user._id.toString())
      expect(viewModel.email).to.equal(user.email)
      expect(viewModel.first_name).to.equal(user.first_name)
      expect(viewModel.invite).to.equal(false)
      expect(viewModel.email).to.exist
      expect(viewModel.enrollment).to.exist
      expect(viewModel.enrollment).to.deep.equal(user.enrollment)
    })

    it('build user id with error', async function () {
      this.UserGetter.promises.getUsers.rejects(new Error('nope'))
      const userId = new ObjectId()
      const [viewModel] = await this.UserMembershipViewModel.buildAsync([
        userId,
      ])
      assertNotCalled(this.UserMembershipViewModel.build)
      expect(viewModel._id).to.equal(userId.toString())
      expect(viewModel.email).not.to.exist
    })
  })
})

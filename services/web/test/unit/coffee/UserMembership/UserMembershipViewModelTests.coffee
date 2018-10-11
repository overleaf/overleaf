chai = require('chai')
should = chai.should()
expect = require('chai').expect
sinon = require('sinon')
assertCalledWith = sinon.assert.calledWith
assertNotCalled = sinon.assert.notCalled
mongojs = require('mongojs')
ObjectId = mongojs.ObjectId
modulePath = "../../../../app/js/Features/UserMembership/UserMembershipViewModel"
SandboxedModule = require("sandboxed-module")

describe 'UserMembershipViewModel', ->
	beforeEach ->
		@UserGetter =
			getUserOrUserStubById: sinon.stub()
		@UserMembershipViewModel = SandboxedModule.require modulePath, requires:
			'mongojs': mongojs
			'../User/UserGetter': @UserGetter
		@email = 'mock-email@bar.com'
		@user = _id: 'mock-user-id', email: 'mock-email@baz.com', first_name: 'Name'
		@userStub = _id: 'mock-user-stub-id', email: 'mock-stub-email@baz.com'

	describe 'build', ->
		it 'build email', ->
			viewModel = @UserMembershipViewModel.build(@email)
			expect(viewModel).to.deep.equal
				email: @email
				invite: true
				first_name: null
				last_name: null
				_id: null

		it 'build user', ->
			viewModel = @UserMembershipViewModel.build(@user)
			expect(viewModel._id).to.equal @user._id
			expect(viewModel.email).to.equal @user.email
			expect(viewModel.invite).to.equal false

	describe 'build async', ->
		beforeEach ->
			@UserMembershipViewModel.build = sinon.stub()

		it 'build email', (done) ->
			@UserMembershipViewModel.buildAsync @email, (error, viewModel) =>
				assertCalledWith(@UserMembershipViewModel.build, @email)
				done()

		it 'build user', (done) ->
			@UserMembershipViewModel.buildAsync @user, (error, viewModel) =>
				assertCalledWith(@UserMembershipViewModel.build, @user)
				done()

		it 'build user id', (done) ->
			@UserGetter.getUserOrUserStubById.yields(null, @user, false)
			@UserMembershipViewModel.buildAsync ObjectId(), (error, viewModel) =>
				should.not.exist(error)
				assertNotCalled(@UserMembershipViewModel.build)
				expect(viewModel._id).to.equal @user._id
				expect(viewModel.email).to.equal @user.email
				expect(viewModel.first_name).to.equal @user.first_name
				expect(viewModel.invite).to.equal false
				should.exist(viewModel.email)
				done()

		it 'build user stub id', (done) ->
			@UserGetter.getUserOrUserStubById.yields(null, @userStub, true)
			@UserMembershipViewModel.buildAsync ObjectId(), (error, viewModel) =>
				should.not.exist(error)
				assertNotCalled(@UserMembershipViewModel.build)
				expect(viewModel._id).to.equal @userStub._id
				expect(viewModel.email).to.equal @userStub.email
				expect(viewModel.invite).to.equal true
				done()

		it 'build user id with error', (done) ->
			@UserGetter.getUserOrUserStubById.yields(new Error('nope'))
			userId = ObjectId()
			@UserMembershipViewModel.buildAsync userId, (error, viewModel) =>
				should.not.exist(error)
				assertNotCalled(@UserMembershipViewModel.build)
				expect(viewModel._id).to.equal userId.toString()
				should.not.exist(viewModel.email)
				done()

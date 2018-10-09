ObjectId = require('mongojs').ObjectId
UserGetter = require('../User/UserGetter')

module.exports = UserMembershipViewModel =
	build: (userOrEmail) ->
		if userOrEmail._id
			buildUserViewModel userOrEmail
		else
			buildUserViewModelWithEmail userOrEmail


	buildAsync: (userOrIdOrEmail, callback = (error, viewModel)->) ->
		unless userOrIdOrEmail instanceof ObjectId
			# userOrIdOrEmail is a user or an email and can be parsed by #build
			return callback(null, UserMembershipViewModel.build(userOrIdOrEmail))

		userId = userOrIdOrEmail
		projection = { email: 1, first_name: 1, last_name: 1 }
		UserGetter.getUserOrUserStubById userId, projection, (error, user, isStub) ->
			if error? or !user?
				return callback(null, buildUserViewModelWithId(userId.toString()))
			if isStub
				return callback(null, buildUserViewModelWithStub(user))
			callback(null, buildUserViewModel(user))


buildUserViewModel = (user, isInvite = false) ->
	_id: user._id or null
	email: user.email or null
	first_name: user.first_name or null
	last_name: user.last_name or null
	invite: isInvite


buildUserViewModelWithEmail = (email) ->
	buildUserViewModel({ email }, true)


buildUserViewModelWithStub = (user) ->
	# user stubs behave as invites
	buildUserViewModel(user, true)


buildUserViewModelWithId = (id) ->
	buildUserViewModel({ _id: id }, false)

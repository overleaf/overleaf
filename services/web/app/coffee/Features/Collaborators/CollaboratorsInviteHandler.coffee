module.experts = CollaboratorsInviteHandler =

	inviteToProject: (projectId, sendingUserId, email, priveleges, callback=(err,invite)->) ->

	revokeInvite: (projectId, inviteId, callback=(err)->) ->

	getInviteByToken: (projectId, tokenString, callback=(err,invite)->) ->

	acceptInvite: (projectId, inviteId, callback=(err)->) ->

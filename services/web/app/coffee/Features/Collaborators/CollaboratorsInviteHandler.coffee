UserCreator = require('../User/UserCreator')
Project = require("../../models/Project").Project
mimelib = require("mimelib")
logger = require('logger-sharelatex')
UserGetter = require "../User/UserGetter"
ContactManager = require "../Contacts/ContactManager"
CollaboratorsEmailHandler = require "./CollaboratorsEmailHandler"
Async = require "async"
PrivilegeLevels = require "../Authorization/PrivilegeLevels"
Errors = require "../Errors/Errors"

module.experts = CollaboratorsInviteHandler =

	inviteToProject: (projectId, sendingUserId, email, priveleges, callback=(err,invite)->) ->

	revokeInvite: (projectId, inviteId, callback=(err)->) ->

	getInviteByToken: (projectId, tokenString, callback=(err,invite)->) ->

	acceptInvite: (projectId, inviteId, callback=(err)->) ->

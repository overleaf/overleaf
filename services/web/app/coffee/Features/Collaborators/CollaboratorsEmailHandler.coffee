Project = require("../../models/Project").Project
EmailHandler = require("../Email/EmailHandler")
Settings = require "settings-sharelatex"


module.exports = CollaboratorsEmailHandler =

	_buildInviteUrl: (project, invite) ->
		"#{Settings.siteUrl}/project/#{project._id}/invite/token/#{invite.token}?" + [
			"project_name=#{encodeURIComponent(project.name)}"
			"user_first_name=#{encodeURIComponent(project.owner_ref.first_name)}"
		].join("&")

	notifyUserOfProjectShare: (project_id, email, callback)->
		Project
			.findOne(_id: project_id )
			.select("name owner_ref")
			.populate('owner_ref')
			.exec (err, project)->
				emailOptions =
					to: email
					replyTo: project.owner_ref.email
					project:
						name: project.name
						url: "#{Settings.siteUrl}/project/#{project._id}?" + [
								"project_name=#{encodeURIComponent(project.name)}"
								"user_first_name=#{encodeURIComponent(project.owner_ref.first_name)}"
								"new_email=#{encodeURIComponent(email)}"
								"r=#{project.owner_ref.referal_id}" # Referal
								"rs=ci" # referral source = collaborator invite
							].join("&")
					owner: project.owner_ref
				EmailHandler.sendEmail "projectSharedWithYou", emailOptions, callback

	notifyUserOfProjectInvite: (project_id, email, invite, callback)->
		Project
			.findOne(_id: project_id )
			.select("name owner_ref")
			.populate('owner_ref')
			.exec (err, project)->
				emailOptions =
					to: email
					replyTo: project.owner_ref.email
					project:
						name: project.name
					inviteUrl: CollaboratorsEmailHandler._buildInviteUrl(project, invite)
					owner: project.owner_ref
				EmailHandler.sendEmail "projectInvite", emailOptions, callback

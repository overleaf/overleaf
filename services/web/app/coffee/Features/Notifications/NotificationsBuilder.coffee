logger = require("logger-sharelatex")
NotificationsHandler = require("./NotificationsHandler")
request = require "request"
settings = require "settings-sharelatex"

module.exports =

	# Note: notification keys should be url-safe

	groupPlan: (user, licence)->
		key : "join-sub-#{licence.subscription_id}"
		create: (callback = ->)->
			messageOpts =
				groupName: licence.name
				subscription_id: licence.subscription_id
			logger.log user_id:user._id, key:@key, "creating notification key for user"
			NotificationsHandler.createNotification user._id, @key, "notification_group_invite", messageOpts, null, callback

		read: (callback = ->)->
			NotificationsHandler.markAsReadWithKey user._id, @key, callback

	projectInvite: (invite, project, sendingUser, user) ->
		key: "project-invite-#{invite._id}"
		create: (callback=()->) ->
			messageOpts =
				userName: sendingUser.first_name
				projectName: project.name
				projectId: project._id.toString()
				token: invite.token
			logger.log {user_id: user._id, project_id: project._id, invite_id: invite._id, key: @key}, "creating project invite notification for user"
			NotificationsHandler.createNotification user._id, @key, "notification_project_invite", messageOpts, invite.expires, callback
		read:  (callback=()->) ->
			NotificationsHandler.markAsReadByKeyOnly @key, callback

	ipMatcherAffiliation: (userId, ip) ->
		return null unless settings?.apis?.v1?.url # service is not configured
		request {
			method: 'GET'
			url: "#{settings.apis.v1.url}/api/v2/users/ip_matcher/#{userId}"
			auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass }
			body: { ip: ip }
			json: true
			timeout: 20 * 1000
		}, (error, response, body) ->
			return error if error?
			return null if response.statusCode == 204

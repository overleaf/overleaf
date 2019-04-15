logger = require("logger-sharelatex")
NotificationsHandler = require("./NotificationsHandler")
request = require "request"
settings = require "settings-sharelatex"

module.exports =
# Note: notification keys should be url-safe

	featuresUpgradedByAffiliation: (affiliation, user) ->
		key: "features-updated-by=#{affiliation.institutionId}"
		create: (callback=()->) ->
			messageOpts =
				institutionName: affiliation.institutionName
			NotificationsHandler.createNotification user._id, @key, "notification_features_upgraded_by_affiliation", messageOpts, null, false, callback
		read: (callback=()->) ->
			NotificationsHandler.markAsRead @key, callback

	redundantPersonalSubscription: (affiliation, user) ->
		key: "redundant-personal-subscription-#{affiliation.institutionId}"
		create: (callback=()->) ->
			messageOpts =
				institutionName: affiliation.institutionName
			NotificationsHandler.createNotification user._id, @key, "notification_personal_subscription_not_required_due_to_affiliation", messageOpts, null, false, callback
		read: (callback=()->) ->
			NotificationsHandler.markAsRead @key, callback

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

	ipMatcherAffiliation: (userId) ->
		create: (ip, callback=()->) ->
			return null unless settings?.apis?.v1?.url # service is not configured
			request {
				method: 'GET'
				url: "#{settings.apis.v1.url}/api/v2/users/#{userId}/ip_matcher"
				auth: { user: settings.apis.v1.user, pass: settings.apis.v1.pass }
				body: { ip: ip }
				json: true
				timeout: 20 * 1000
			}, (error, response, body) ->
				return error if error?
				return null unless response.statusCode == 200

				key = "ip-matched-affiliation-#{body.id}"
				messageOpts =
					university_name: body.name
					content: body.enrolment_ad_html
				logger.log user_id:userId, key:key, "creating notification key for user"
				NotificationsHandler.createNotification userId, key, "notification_ip_matched_affiliation", messageOpts, null, false, callback

		read: (university_id, callback = ->)->
			key = "ip-matched-affiliation-#{university_id}"
			NotificationsHandler.markAsReadWithKey userId, key, callback

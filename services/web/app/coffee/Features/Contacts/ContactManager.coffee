request = require "request"
settings = require "settings-sharelatex"
logger = require "logger-sharelatex"

module.exports = ContactManager =
	getContactIds: (user_id, options = { limits: 50 }, callback = (error, contacts) ->) ->
		logger.log {user_id}, "getting user contacts"
		url = "#{settings.apis.contacts.url}/user/#{user_id}/contacts"
		request.get {
			url: url
			qs: options
			json: true
			jar: false
		}, (error, res, data) ->
			return callback(error) if error?
			if 200 <= res.statusCode < 300
				callback(null, data?.contact_ids or [])
			else
				error = new Error("contacts api responded with non-success code: #{res.statusCode}")
				logger.error {err: error, user_id}, "error getting contacts for user"
				callback(error)
	
	addContact: (user_id, contact_id, callback = (error) ->) ->
		logger.log {user_id, contact_id}, "add user contact"
		url = "#{settings.apis.contacts.url}/user/#{user_id}/contacts"
		request.post {
			url: url
			json: {
				contact_id: contact_id
			}
			jar: false
		}, (error, res, data) ->
			return callback(error) if error?
			if 200 <= res.statusCode < 300
				callback(null, data?.contact_ids or [])
			else
				error = new Error("contacts api responded with non-success code: #{res.statusCode}")
				logger.error {err: error, user_id, contact_id}, "error adding contact for user"
				callback(error)
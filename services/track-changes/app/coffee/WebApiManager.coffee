request = require "request"
logger = require "logger-sharelatex"
Settings = require "settings-sharelatex"

module.exports = WebApiManager =
	getUserInfo: (user_id, callback = (error, userInfo) ->) ->
		url = "#{Settings.apis.web.url}/user/#{user_id}/personal_info"
		logger.log user_id: user_id, "getting user info from web"
		request.get {
			url: url
			auth:
				user: Settings.apis.web.user
				pass: Settings.apis.web.pass
				sendImmediately: true
		}, (error, res, body)->
			if error?
				return callback(error)
			if res.statusCode >= 200 and res.statusCode < 300
				try
					user = JSON.parse(body)
				catch error
					return callback(error)
				callback null, {
					id: user.id
					email: user.email
					first_name: user.first_name
					last_name: user.last_name
				}
			else
				error = new Error("web returned a non-success status code: #{res.statusCode}")
				logger.error err: error, user_id: user_id, url: url, "error accessing web"
				callback error
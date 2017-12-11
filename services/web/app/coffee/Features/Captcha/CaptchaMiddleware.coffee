request = require 'request'
logger = require 'logger-sharelatex'
Settings = require 'settings-sharelatex'

module.exports = CaptchaMiddleware =
	validateCaptcha: (req, res, next) ->
		if !Settings.recaptcha?
			return next()
		response = req.body['g-recaptcha-response']
		options =
			form:
				secret: Settings.recaptcha.secretKey
				response: response
			json: true
		request.post "https://www.google.com/recaptcha/api/siteverify", options, (error, response, body) ->
			return next(error) if error?
			if !body?.success
				logger.warn {statusCode: response.statusCode, body: body}, 'failed recaptcha siteverify request'
				return res.sendStatus 400
			else
				return next()

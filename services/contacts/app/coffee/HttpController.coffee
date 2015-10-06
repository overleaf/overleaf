ContactManager = require "./ContactManager"
logger = require "logger-sharelatex"

module.exports = HttpController =
	addContact: (req, res, next) ->
		{user_id} = req.params
		{contact_id} = req.body
		
		if !contact_id? or contact_id == ""
			res.status(400).send("contact_id should be a non-blank string")
			return
			
		logger.log {user_id, contact_id}, "adding contact"

		ContactManager.touchContact user_id, contact_id, (error) ->
			return next(error) if error?
			ContactManager.touchContact contact_id, user_id, (error) ->
				return next(error) if error?
				res.status(204).end()

	getUserContacts: (req, res, next) ->
		
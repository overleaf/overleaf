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

	CONTACT_LIMIT: 50
	getContacts: (req, res, next) ->
		{user_id} = req.params

		if req.query?.limit?
			limit = parseInt(req.query.limit, 10)
		else
			limit = HttpController.CONTACT_LIMIT
		limit = Math.min(limit, HttpController.CONTACT_LIMIT)

		logger.log {user_id}, "getting contacts"

		ContactManager.getContacts user_id, (error, contact_dict) ->
			return next(error) if error?
			
			contacts = []
			for user_id, data of (contact_dict or {})
				contacts.push {
					user_id: user_id
					n: data.n
					ts: data.ts
				}

			HttpController._sortContacts contacts
			contacts = contacts.slice(0, limit)
			contact_ids = contacts.map (contact) -> contact.user_id

			res.status(200).send({
				contact_ids: contact_ids
			})
	
	_sortContacts: (contacts) ->
		contacts.sort (a, b) ->
			# Sort by decreasing count, descreasing timestamp.
			# I.e. biggest count, and most recent at front.
			if a.n > b.n
				return -1
			else if a.n < b.n
				return 1
			else
				if a.ts > b.ts
					return -1
				else if a.ts < b.ts
					return 1
				else
					return 0

AuthenticationController = require "../Authentication/AuthenticationController"
ContactManager = require "./ContactManager"
UserGetter = require "../User/UserGetter"
logger = require "logger-sharelatex"
Modules = require "../../infrastructure/Modules"

module.exports = ContactsController =
	getContacts: (req, res, next) ->
		user_id = AuthenticationController.getLoggedInUserId req
		ContactManager.getContactIds user_id, {limit: 50}, (error, contact_ids) ->
			return next(error) if error?
			UserGetter.getUsers contact_ids, {
				email: 1, first_name: 1, last_name: 1, holdingAccount: 1
			}, (error, contacts) ->
				return next(error) if error?

				# UserGetter.getUsers may not preserve order so put them back in order
				positions = {}
				for contact_id, i in contact_ids
					positions[contact_id] = i
				contacts.sort (a,b) -> positions[a._id?.toString()] - positions[b._id?.toString()]

				# Don't count holding accounts to discourage users from repeating mistakes (mistyped or wrong emails, etc)
				contacts = contacts.filter (c) -> !c.holdingAccount

				contacts = contacts.map(ContactsController._formatContact)

				Modules.hooks.fire "getContacts", user_id, contacts, (error, additional_contacts) ->
					return next(error) if error?
					contacts = contacts.concat(additional_contacts...)
					res.send({
						contacts: contacts
					})

	_formatContact: (contact) ->
		return  {
			id: contact._id?.toString()
			email: contact.email
			first_name: contact.first_name
			last_name: contact.last_name
			type: "user"
		}

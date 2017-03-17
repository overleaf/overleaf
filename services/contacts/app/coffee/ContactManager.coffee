{db, ObjectId} = require "./mongojs"
logger = require('logger-sharelatex')
metrics = require('metrics-sharelatex')

module.exports = ContactManager =
	touchContact: (user_id, contact_id, callback = (error) ->) ->
		try
			user_id = ObjectId(user_id.toString())
		catch error
			return callback error

		update = { $set: {}, $inc: {} }
		update.$inc["contacts.#{contact_id}.n"] = 1
		update.$set["contacts.#{contact_id}.ts"] = new Date()

		db.contacts.update({
			user_id: user_id
		}, update, {
			upsert: true
		}, callback)
	
	getContacts: (user_id, callback = (error) ->) ->
		try
			user_id = ObjectId(user_id.toString())
		catch error
			return callback error
		
		db.contacts.findOne {
			user_id: user_id
		}, (error, user) ->
			return callback(error) if error?
			callback null, user?.contacts

[
	'touchContact',
	'getContacts',
].map (method) ->
	metrics.timeAsyncMethod(ContactManager, method, 'mongo.ContactManager', logger)

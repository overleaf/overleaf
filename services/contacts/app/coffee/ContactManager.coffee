{db, ObjectId} = require "./mongojs"

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
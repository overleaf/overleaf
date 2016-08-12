Settings = require 'settings-sharelatex'
logger = require('logger-sharelatex')
mongojs = require('mongojs')
db = mongojs(Settings.mongo?.url, ['notifications'])
ObjectId = require("mongojs").ObjectId

module.exports =

	getUserNotifications: (user_id, callback = (err, notifications)->)->
		query =
			user_id: ObjectId(user_id)
			templateKey: {"$exists":true}
		db.notifications.find query, (err, notifications)->
			callback err, notifications

	addNotification: (user_id, notification, callback)->
		query =
			user_id: ObjectId(user_id)
			key: notification.key
		db.notifications.count query, (err, number)->
			if number > 0
				logger.log number:number, user_id:user_id, key:notification.key, "alredy has notification key for user"
				callback number
			else
				doc =
					user_id: ObjectId(user_id)
					key: notification.key
					messageOpts: notification.messageOpts
					templateKey: notification.templateKey
				# TTL index on the optional `expires` field, which should arrive as an iso date-string, corresponding to
				# a datetime in the future when the document should be automatically removed.
				# in Mongo, TTL indexes only work on date fields, and ignore the document when that field is missing
				# see `README.md` for instruction on creating TTL index
				if notification.expires?
					doc.expires =  new Date(notification.expires)
				db.notifications.insert(doc, callback)

	removeNotificationId: (user_id, notification_id, callback)->
		searchOps =
			user_id:ObjectId(user_id)
			_id:ObjectId(notification_id)
		updateOperation =
			"$unset": {templateKey:true, messageOpts: true}
		db.notifications.update searchOps, updateOperation, callback

	removeNotificationKey: (user_id, notification_key, callback)->
		searchOps =
			user_id:ObjectId(user_id)
			key: notification_key
		updateOperation =
			"$unset": {templateKey:true}
		db.notifications.update searchOps, updateOperation, callback

	removeNotificationByKeyOnly: (notification_key, callback)->
		searchOps =
			key: notification_key
		updateOperation =
			"$unset": {templateKey:true}
		db.notifications.update searchOps, updateOperation, callback

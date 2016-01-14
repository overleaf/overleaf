Settings = require 'settings-sharelatex'
logger = require('logger-sharelatex')
mongojs = require('mongojs')
db = mongojs(Settings.mongo?.url, ['notifications'])

module.exports =

	getUserUnreadNotifications: (user_id, callback = (err, user)->)->
		db.notifications.find {"user_id" : user_id}, (err, user)->
			callback err, user

	addNotification: (user_id, notification, callback)->
		doc = 
			user_id: user_id
			key: notification.key
			messageOpts: notification.messageOpts
			templateKey: notification.templateKey
		db.notifications.insert(doc, callback)

	removeNotification: (user_id, notification_key, callback)->
		searchOps = 
			user_id:user_id
			key:notification_key
		updateOperation = 
			"$set": {read:true}
		db.notifications.update searchOps, updateOperation, callback

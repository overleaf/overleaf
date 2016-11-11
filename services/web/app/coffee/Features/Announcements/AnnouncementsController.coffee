AnnouncementsHandler = require("./AnnouncementsHandler")
AuthenticationController = require("../Authentication/AuthenticationController")
logger = require("logger-sharelatex")


module.exports =

	getUndreadAnnouncements: (req, res, next)->
		if !settings?.apis?.analytics?.url? or !settings.apis.blog.url?
			return res.json []

		user_id = AuthenticationController.getLoggedInUserId(req)
		logger.log {user_id}, "getting unread announcements"
		AnnouncementsHandler.getUnreadAnnouncements user_id, (err, announcements)->
			if err?
				logger.err {err, user_id}, "unable to get unread announcements"
				next(err)
			else
				res.json announcements






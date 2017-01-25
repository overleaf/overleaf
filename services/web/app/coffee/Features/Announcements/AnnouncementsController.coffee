AnnouncementsHandler = require("./AnnouncementsHandler")
AuthenticationController = require("../Authentication/AuthenticationController")
logger = require("logger-sharelatex")
settings = require("settings-sharelatex")

module.exports =

	getUndreadAnnouncements: (req, res, next)->
		if !settings?.apis?.analytics?.url? or !settings.apis.blog.url?
			return res.json []

		user = AuthenticationController.getSessionUser(req)
		logger.log {user_id:user?._id}, "getting unread announcements"
		AnnouncementsHandler.getUnreadAnnouncements user, (err, announcements)->
			if err?
				logger.err {err:err, user_id:user._id}, "unable to get unread announcements"
				next(err)
			else
				res.json announcements






AnalyticsManager = require("../Analytics/AnalyticsManager")
BlogHandler = require("../Blog/BlogHandler")
async = require("async")
_ = require("lodash")
logger = require("logger-sharelatex")
settings = require("settings-sharelatex")

module.exports =

	getUnreadAnnouncements : (user_id, callback = (err, announcements)->)->
		if !settings?.apis?.analytics?.url? or !settings.apis.blog.url?
			return callback null, []

		async.parallel {
			lastEvent: (cb)->
				AnalyticsManager.getLastOccurance user_id, "announcement-alert-dismissed", cb
			announcements: (cb)->
				BlogHandler.getLatestAnnouncements cb
		}, (err, results)->
			if err?
				logger.err err:err, user_id:user_id, "error getting unread announcements"
				return callback(err)
			
			announcements = _.sortBy(results.announcements, "date").reverse()

			lastSeenBlogId = results?.lastEvent?.segmentation?.blogPostId

			announcementIndex = _.findIndex announcements, (announcement)-> 
				announcement.id == lastSeenBlogId

			if announcementIndex != -1
				announcements = announcements.slice(0, announcementIndex)

			logger.log announcementsLength:announcements?.length, user_id:user_id, "returning announcements"

			callback null, announcements

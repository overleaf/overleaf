AnalyticsManager = require("../Analytics/AnalyticsManager")
BlogHandler = require("../Blog/BlogHandler")
logger = require("logger-sharelatex")
settings = require("settings-sharelatex")
async = require("async")
_ = require("lodash")

module.exports = AnnouncementsHandler = 

	_domainSpecificAnnouncements : (email)->
		domainSpecific = _.filter settings?.domainAnnouncements, (domainAnnouncment)->
			matches = _.filter domainAnnouncment.domains, (domain)->
				return email.indexOf(domain) != -1
			return matches.length > 0 and domainAnnouncment.id?
		return domainSpecific or []


	getUnreadAnnouncements : (user, callback = (err, announcements)->)->
		if !user? and !user._id?
			return callback("user not supplied")

		timestamp = user._id.toString().substring(0,8)
		userSignupDate = new Date( parseInt( timestamp, 16 ) * 1000 )

		async.parallel {
			lastEvent: (cb)->
				AnalyticsManager.getLastOccurrence user._id, "announcement-alert-dismissed", cb
			announcements: (cb)->
				BlogHandler.getLatestAnnouncements cb
		}, (err, results)->
			if err?
				logger.err err:err, user_id:user._id, "error getting unread announcements"
				return callback(err)
			
			domainSpecific = AnnouncementsHandler._domainSpecificAnnouncements(user?.email)

			domainSpecific = _.map domainSpecific, (domainAnnouncment)->
				try
					domainAnnouncment.date = new Date(domainAnnouncment.date)
					return domainAnnouncment
				catch e
					return callback(e)

			announcements = results.announcements
			announcements = _.union announcements, domainSpecific
			announcements = _.sortBy(announcements, "date").reverse()

			lastSeenBlogId = results?.lastEvent?.segmentation?.blogPostId

			announcementIndex = _.findIndex announcements, (announcement)-> 
				announcement.id == lastSeenBlogId

			announcements = _.map announcements, (announcement, index)->
				if announcement.date < userSignupDate
					read = true
				else if announcementIndex == -1
					read = false
				else if index >= announcementIndex
					read = true
				else
					read = false
				announcement.read = read
				return announcement

			logger.log announcementsLength:announcements?.length, user_id:user?._id, "returning announcements"

			callback null, announcements

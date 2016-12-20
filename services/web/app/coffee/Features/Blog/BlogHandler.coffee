request = require "request"
settings = require "settings-sharelatex"
_ = require("underscore")
logger = require "logger-sharelatex"

module.exports = BlogHandler =

	getLatestAnnouncements: (callback)->
		blogUrl = "#{settings.apis.blog.url}/blog/latestannouncements.json"
		opts = 
			url:blogUrl
			json:true
			timeout:500
		request.get opts, (err, res, announcements)->
			if err?
				return callback err
			if res.statusCode != 200
				return callback("blog announcement returned non 200")
			logger.log announcementsLength: announcements?.length, "announcements returned"
			announcements = _.map announcements, (announcement)->
				announcement.url = "/blog#{announcement.url}"
				announcement.date = new Date(announcement.date)
				return announcement
			callback(err, announcements)

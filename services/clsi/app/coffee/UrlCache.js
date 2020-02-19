db = require("./db")
dbQueue = require "./DbQueue"
UrlFetcher = require("./UrlFetcher")
Settings = require("settings-sharelatex")
crypto = require("crypto")
fs = require("fs")
logger = require "logger-sharelatex"
async = require "async"

module.exports = UrlCache =
	downloadUrlToFile: (project_id, url, destPath, lastModified, callback = (error) ->) ->
		UrlCache._ensureUrlIsInCache project_id, url, lastModified, (error, pathToCachedUrl) =>
			return callback(error) if error?
			UrlCache._copyFile pathToCachedUrl, destPath, (error) ->
				if error?
					UrlCache._clearUrlDetails project_id, url, () ->
						callback(error)
				else
					callback(error)

	clearProject: (project_id, callback = (error) ->) ->
		UrlCache._findAllUrlsInProject project_id, (error, urls) ->
			logger.log project_id: project_id, url_count: urls.length, "clearing project URLs"
			return callback(error) if error?
			jobs = for url in (urls or [])
				do (url) ->
					(callback) ->
						UrlCache._clearUrlFromCache project_id, url, (error) ->
							if error?
								logger.error err: error, project_id: project_id, url: url, "error clearing project URL"
							callback()
			async.series jobs, callback

	_ensureUrlIsInCache: (project_id, url, lastModified, callback = (error, pathOnDisk) ->) ->
		if lastModified?
			# MYSQL only stores dates to an accuracy of a second but the incoming lastModified might have milliseconds.
			# So round down to seconds
			lastModified = new Date(Math.floor(lastModified.getTime() / 1000) * 1000)
		UrlCache._doesUrlNeedDownloading project_id, url, lastModified, (error, needsDownloading) =>
			return callback(error) if error?
			if needsDownloading
				logger.log url: url, lastModified: lastModified, "downloading URL"
				UrlFetcher.pipeUrlToFile url, UrlCache._cacheFilePathForUrl(project_id, url), (error) =>
					return callback(error) if error?
					UrlCache._updateOrCreateUrlDetails project_id, url, lastModified, (error) =>
						return callback(error) if error?
						callback null, UrlCache._cacheFilePathForUrl(project_id, url)
			else
				logger.log url: url, lastModified: lastModified, "URL is up to date in cache"
				callback null, UrlCache._cacheFilePathForUrl(project_id, url)
	
	_doesUrlNeedDownloading: (project_id, url, lastModified, callback = (error, needsDownloading) ->) ->
		if !lastModified?
			return callback null, true
		UrlCache._findUrlDetails project_id, url, (error, urlDetails) ->
			return callback(error) if error?
			if !urlDetails? or !urlDetails.lastModified? or urlDetails.lastModified.getTime() < lastModified.getTime()
				return callback null, true
			else
				return callback null, false

	_cacheFileNameForUrl: (project_id, url) ->
		project_id + ":" + crypto.createHash("md5").update(url).digest("hex")

	_cacheFilePathForUrl: (project_id, url) ->
		"#{Settings.path.clsiCacheDir}/#{UrlCache._cacheFileNameForUrl(project_id, url)}"

	_copyFile: (from, to, _callback = (error) ->) ->
		callbackOnce = (error) ->
			if error?
				logger.error err: error, from:from, to:to, "error copying file from cache"
			_callback(error)
			_callback = () ->
		writeStream = fs.createWriteStream(to)
		readStream = fs.createReadStream(from)
		writeStream.on "error", callbackOnce
		readStream.on "error", callbackOnce
		writeStream.on "close", callbackOnce
		writeStream.on "open", () ->
			readStream.pipe(writeStream)

	_clearUrlFromCache: (project_id, url, callback = (error) ->) ->
		UrlCache._clearUrlDetails project_id, url, (error) ->
			return callback(error) if error?
			UrlCache._deleteUrlCacheFromDisk project_id, url, (error) ->
				return callback(error) if error?
				callback null

	_deleteUrlCacheFromDisk: (project_id, url, callback = (error) ->) ->
		fs.unlink UrlCache._cacheFilePathForUrl(project_id, url), (error) ->
			if error? and error.code != 'ENOENT' # no error if the file isn't present
				return callback(error)
			else
				return callback()

	_findUrlDetails: (project_id, url, callback = (error, urlDetails) ->) ->
		job = (cb)->
			db.UrlCache.find(where: { url: url, project_id: project_id })
				.then((urlDetails) -> cb null, urlDetails)
				.error cb
		dbQueue.queue.push job, callback

	_updateOrCreateUrlDetails: (project_id, url, lastModified, callback = (error) ->) ->
		job = (cb)->
			db.UrlCache.findOrCreate(where: {url: url, project_id: project_id})
				.spread(
					(urlDetails, created) ->
						urlDetails.updateAttributes(lastModified: lastModified)
							.then(() -> cb())
							.error(cb)
				)
				.error cb
		dbQueue.queue.push(job, callback)

	_clearUrlDetails: (project_id, url, callback = (error) ->) ->
		job = (cb)->
			db.UrlCache.destroy(where: {url: url, project_id: project_id})
				.then(() -> cb null)
				.error cb
		dbQueue.queue.push(job, callback)


	_findAllUrlsInProject: (project_id, callback = (error, urls) ->) ->
		job = (cb)->
			db.UrlCache.findAll(where: { project_id: project_id })
				.then(
					(urlEntries) ->
						cb null, urlEntries.map((entry) -> entry.url)
				)
				.error cb
		dbQueue.queue.push(job, callback)

		
		

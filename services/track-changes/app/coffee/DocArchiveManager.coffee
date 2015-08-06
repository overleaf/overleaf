MongoManager = require "./MongoManager"
logger = require "logger-sharelatex"
_ = require "underscore"
async = require "async"
settings = require("settings-sharelatex")
request = require("request")
crypto = require("crypto")
thirtySeconds = 30 * 1000

module.exports = DocArchiveManager =

	archiveAllDocsChanges: (project_id, callback = (error, docs) ->) ->
		MongoManager.getProjectsDocs project_id, (error, docs) ->
			if error?
				return callback(error)
			else if !docs?
				return callback new Error("No docs for project #{project_id}")
			jobs = _.map docs, (doc) ->
				(cb)-> DocArchiveManager.archiveDocChanges project_id, doc._id, cb
			async.series jobs, callback


	archiveDocChanges: (project_id, doc_id, callback)->
		MongoManager.getDocChanges doc_id, (error, docChanges) ->
			logger.log project_id: project_id, doc_id: doc_id, "sending doc changes to s3"
			options = DocArchiveManager.buildS3Options(docChanges, project_id+"/changes-"+doc_id)
			request.put options, (err, res)->
				md5lines = crypto.createHash("md5").update(JSON.stringify(docChanges)).digest("hex")
				md5response = res.headers.etag.toString().replace(/\"/g, '')
				if err? || res.statusCode != 200
					logger.err err:err, res:res, "something went wrong archiving doc changes in aws"
					return callback new Error("Error in S3 request")
				if md5lines != md5response
					logger.err responseMD5:md5response, linesMD5:md5lines, "error in response md5 from s3"
					return callback new Error("Error in S3 md5 response")
				#MongoManager.markDocAsArchived doc._id, doc.rev, (error) ->
				#	return callback(error) if error?
				callback()

	buildS3Options: (content, key)->
		return {
				aws:
					key: settings.filestore.s3.key
					secret: settings.filestore.s3.secret
					bucket: settings.filestore.stores.user_files
				timeout: thirtySeconds
				json: content
				uri:"https://#{settings.filestore.stores.user_files}.s3.amazonaws.com/#{key}"
		}
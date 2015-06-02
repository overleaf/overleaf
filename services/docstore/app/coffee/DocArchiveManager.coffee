MongoManager = require "./MongoManager"
Errors = require "./Errors"
logger = require "logger-sharelatex"
_ = require "underscore"
async = require "async"
settings = require("settings-sharelatex")
request = require("request")
crypto = require("crypto")
thirtySeconds = 30 * 1000

module.exports = DocArchive =

	archiveAllDocs: (project_id, callback = (error, docs) ->) ->
		MongoManager.getProjectsDocs project_id, (error, docs) ->
			if error?
				return callback(error)
			else if !docs?
				return callback new Errors.NotFoundError("No docs for project #{project_id}")
			jobs = _.map docs, (doc) ->
				(cb)-> DocArchive.archiveDoc project_id, doc, cb
			async.series jobs, callback


	archiveDoc: (project_id, doc, callback)->
		logger.log project_id: project_id, doc_id: doc._id, "sending doc to s3"
		options = DocArchive.buildS3Options(doc.lines, project_id+"/"+doc._id)
		request.put options, (err, res)->
			if err? || res.statusCode != 200
				logger.err err:err, res:res, "something went wrong archiving doc in aws"
				return callback new Errors.NotFoundError("Error in S3 request")
			MongoManager.markDocAsArchived doc._id, doc.rev, (error) ->
				return callback(error) if error?
				callback()

	unArchiveAllDocs: (project_id, callback = (error) ->) ->
		MongoManager.getArchivedProjectDocs project_id, (error, docs) ->
			if error?
				return callback(error)
			else if !docs?
				return callback new Errors.NotFoundError("No docs for project #{project_id}")
			jobs = _.map docs, (doc) ->
				(cb)->
					if !doc.inS3?
						return cb()
					else
						DocArchive.unarchiveDoc project_id, doc._id, cb
			async.series jobs, callback

	unarchiveDoc: (project_id, doc_id, callback)->
		logger.log project_id: project_id, doc_id: doc_id, "getting doc from s3"
		options = DocArchive.buildS3Options(true, project_id+"/"+doc_id)
		request.get options, (err, res, lines)->
			if err? || res.statusCode != 200
				logger.err err:err, res:res, "something went wrong unarchiving doc from aws"
				return callback new Errors.NotFoundError("Error in S3 request")
			MongoManager.upsertIntoDocCollection project_id, doc_id.toString(), lines, (error) ->
				return callback(error) if error?
				callback()

	buildS3Options: (content, key)->
		return {
				aws:
					key: settings.filestore.s3.key
					secret: settings.filestore.s3.secret
					bucket: settings.filestore.stores.user_files
				timeout: thirtySeconds
				json: content
				#headers:
				#	'content-md5': crypto.createHash("md5").update(content).digest("hex")
				uri:"https://#{settings.filestore.stores.user_files}.s3.amazonaws.com/#{key}"
		}
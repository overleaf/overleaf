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

	archiveAllDocs: (project_id, callback = (err, docs) ->) ->
		MongoManager.getProjectsDocs project_id, {include_deleted: true}, {lines: true, rev: true, inS3: true}, (err, docs) ->
			if err?
				return callback(err)
			else if !docs?
				return callback new Errors.NotFoundError("No docs for project #{project_id}")
			docs = _.filter docs, (doc)-> doc.inS3 != true
			jobs = _.map docs, (doc) ->
				(cb)->
					DocArchive.archiveDoc project_id, doc, cb
			async.parallelLimit jobs, 5, callback


	archiveDoc: (project_id, doc, callback)->
		logger.log project_id: project_id, doc_id: doc._id, "sending doc to s3"
		try
			options = DocArchive.buildS3Options(doc.lines, project_id+"/"+doc._id)
		catch e
			return callback e
		request.put options, (err, res)->
			if err? || res.statusCode != 200
				logger.err err:err, res:res, project_id:project_id, doc_id: doc._id, statusCode: res?.statusCode, "something went wrong archiving doc in aws"
				return callback new Error("Error in S3 request")
			md5lines = crypto.createHash("md5").update(JSON.stringify(doc.lines), "utf8").digest("hex")
			md5response = res.headers.etag.toString().replace(/\"/g, '')
			if md5lines != md5response
				logger.err responseMD5:md5response, linesMD5:md5lines,  project_id:project_id, doc_id: doc?._id, "err in response md5 from s3"
				return callback new Error("Error in S3 md5 response")
			MongoManager.markDocAsArchived doc._id, doc.rev, (err) ->
				return callback(err) if err?
				callback()

	unArchiveAllDocs: (project_id, callback = (err) ->) ->
		MongoManager.getArchivedProjectDocs project_id, (err, docs) ->
			if err?
				logger.err err:err, project_id:project_id, "error unarchiving all docs"
				return callback(err)
			else if !docs?
				return callback new Errors.NotFoundError("No docs for project #{project_id}")
			jobs = _.map docs, (doc) ->
				(cb)->
					if !doc.inS3?
						return cb()
					else
						DocArchive.unarchiveDoc project_id, doc._id, cb
			async.parallelLimit jobs, 5, callback

	unarchiveDoc: (project_id, doc_id, callback)->
		logger.log project_id: project_id, doc_id: doc_id, "getting doc from s3"
		try
			options = DocArchive.buildS3Options(true, project_id+"/"+doc_id)
		catch e
			return callback e
		request.get options, (err, res, lines)->
			if err? || res.statusCode != 200
				logger.err err:err, res:res, project_id:project_id, doc_id:doc_id, "something went wrong unarchiving doc from aws"
				return callback new Errors.NotFoundError("Error in S3 request")
			if !(lines instanceof Array)
				logger.err err:err, res:res, project_id:project_id, doc_id:doc_id, "doc lines from aws are not in array format, likely not JSON parsable"
				return callback(new Error("Error unpacking doc"))
			MongoManager.upsertIntoDocCollection project_id, doc_id.toString(), {lines}, (err) ->
				return callback(err) if err?
				logger.log project_id: project_id, doc_id: doc_id, "deleting doc from s3"
				request.del options, (err, res, body)->
					if err? || res.statusCode != 204
						logger.err err:err, res:res, project_id:project_id, doc_id:doc_id, "something went wrong deleting doc from aws"
						return callback new Errors.NotFoundError("Error in S3 request")
					callback()

	buildS3Options: (content, key)->
		if !settings.docstore.s3?
			throw new Error("S3 settings are not configured")
		return {
				aws:
					key: settings.docstore.s3.key
					secret: settings.docstore.s3.secret
					bucket: settings.docstore.s3.bucket
				timeout: thirtySeconds
				json: content
				uri:"https://#{settings.docstore.s3.bucket}.s3.amazonaws.com/#{key}"
		}
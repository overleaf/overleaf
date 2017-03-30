MongoManager = require "./MongoManager"
Errors = require "./Errors"
logger = require "logger-sharelatex"
_ = require "underscore"
async = require "async"
settings = require("settings-sharelatex")
request = require("request")
crypto = require("crypto")
RangeManager = require("./RangeManager")
thirtySeconds = 30 * 1000

module.exports = DocArchive =

	archiveAllDocs: (project_id, callback = (err, docs) ->) ->
		MongoManager.getProjectsDocs project_id, {include_deleted: true}, {lines: true, ranges: true, rev: true, inS3: true}, (err, docs) ->
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
			options = DocArchive.buildS3Options(project_id+"/"+doc._id)
		catch e
			return callback e
		DocArchive._mongoDocToS3Doc doc, (error, json_doc) ->
			return callback(error) if error?
			options.body = json_doc
			options.headers =
				'Content-Type': "application/json"
			request.put options, (err, res) ->
				if err? || res.statusCode != 200
					logger.err err:err, res:res, project_id:project_id, doc_id: doc._id, statusCode: res?.statusCode, "something went wrong archiving doc in aws"
					return callback new Error("Error in S3 request")
				md5lines = crypto.createHash("md5").update(json_doc, "utf8").digest("hex")
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
			options = DocArchive.buildS3Options(project_id+"/"+doc_id)
		catch e
			return callback e
		options.json = true
		request.get options, (err, res, doc)->
			if err? || res.statusCode != 200
				logger.err err:err, res:res, project_id:project_id, doc_id:doc_id, "something went wrong unarchiving doc from aws"
				return callback new Errors.NotFoundError("Error in S3 request")
			DocArchive._s3DocToMongoDoc doc, (error, mongo_doc) ->
				return callback(error) if error?
				MongoManager.upsertIntoDocCollection project_id, doc_id.toString(), mongo_doc, (err) ->
					return callback(err) if err?
					logger.log project_id: project_id, doc_id: doc_id, "deleting doc from s3"
					request.del options, (err, res, body)->
						if err? || res.statusCode != 204
							logger.err err:err, res:res, project_id:project_id, doc_id:doc_id, "something went wrong deleting doc from aws"
							return callback new Errors.NotFoundError("Error in S3 request")
						callback()
	
	_s3DocToMongoDoc: (doc, callback = (error, mongo_doc) ->) ->
		mongo_doc = {}
		if doc.schema_v == 1 and doc.lines?
			mongo_doc.lines = doc.lines
			if doc.ranges?
				mongo_doc.ranges = RangeManager.jsonRangesToMongo(doc.ranges)
		else if doc instanceof Array
			mongo_doc.lines = doc
		else
			return callback(new Error("I don't understand the doc format in s3"))
		return callback null, mongo_doc

	_mongoDocToS3Doc: (doc, callback = (error, s3_doc) ->) ->
		json = JSON.stringify({
			lines: doc.lines
			ranges: doc.ranges
			schema_v: 1
		})
		if json.indexOf("\u0000") != -1
			error = new Error("null bytes detected")
			logger.error {err: error, project_id, doc_id}, error.message
			return callback(error)
		return callback null, json

	buildS3Options: (key)->
		if !settings.docstore.s3?
			throw new Error("S3 settings are not configured")
		return {
				aws:
					key: settings.docstore.s3.key
					secret: settings.docstore.s3.secret
					bucket: settings.docstore.s3.bucket
				timeout: thirtySeconds
				uri:"https://#{settings.docstore.s3.bucket}.s3.amazonaws.com/#{key}"
		}
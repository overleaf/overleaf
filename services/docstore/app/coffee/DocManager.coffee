MongoManager = require "./MongoManager"
Errors = require "./Errors"
logger = require "logger-sharelatex"
_ = require "underscore"
async = require "async"
settings = require("settings-sharelatex")
request = require("request")
crypto = require("crypto")
thirtySeconds = 30 * 1000

module.exports = DocManager =

	getDoc: (project_id, doc_id, callback = (error, doc) ->) ->
		MongoManager.findDoc doc_id, (err, doc)->
			if err?
				return callback(err)
			else if !doc?
				return callback new Errors.NotFoundError("No such doc: #{doc_id} in project #{project_id}")
			callback null, doc

	getAllDocs: (project_id, callback = (error, docs) ->) ->
		MongoManager.getProjectsDocs project_id, (error, docs) ->
			if err?
				return callback(error)
			else if !docs?
				return callback new Errors.NotFoundError("No docs for project #{project_id}")
			else
				return callback(null, docs)

	updateDoc: (project_id, doc_id, lines, callback = (error, modified, rev) ->) ->
		MongoManager.findDoc doc_id, (err, doc)->
			if err?
				logger.err project_id: project_id, doc_id: doc_id, err:err, "error getting document for update"
				return callback(err)

			isNewDoc = lines.length == 0
			linesAreSame =  _.isEqual(doc?.lines, lines)

			if linesAreSame and !isNewDoc
				logger.log project_id: project_id, doc_id: doc_id, rev: doc?.rev, "doc lines have not changed - not updating"
				return callback null, false, doc?.rev
			else
				oldRev = doc?.rev || 0
				logger.log {
					project_id: project_id
					doc_id: doc_id,
					oldDocLines: doc?.lines
					newDocLines: lines
					rev: oldRev
				}, "updating doc lines"
				MongoManager.upsertIntoDocCollection project_id, doc_id, lines, (error)->
					return callback(callback) if error?
					callback null, true,  oldRev + 1 # rev will have been incremented in mongo by MongoManager.updateDoc

	deleteDoc: (project_id, doc_id, callback = (error) ->) ->
		DocManager.getDoc project_id, doc_id, (error, doc) ->
			return callback(error) if error?
			return callback new Errors.NotFoundError("No such project/doc to delete: #{project_id}/#{doc_id}") if !doc?
			MongoManager.upsertIntoDocCollection project_id, doc_id, doc.lines, (error) ->
				return callback(error) if error?
				MongoManager.markDocAsDeleted doc_id, (error) ->
					return callback(error) if error?
					callback()

	archiveAllDocs: (project_id, callback = (error, docs) ->) ->
		MongoManager.getProjectsDocs project_id, (error, docs) ->
			if err?
				return callback(error)
			else if !docs?
				return callback new Errors.NotFoundError("No docs for project #{project_id}")

			jobs = for doc in docs
				do (doc) =>
					(cb) => 
						logger.log project_id: project_id, doc_id: doc._id, "sending doc to s3"
						options = buildS3Options(doc.lines, project_id+"/"+doc._id)
						request.put options, (err, res)->
							if err? || res.statusCode != 200
								logger.err err:err, res:res, "something went wrong archiving file in aws"
							cb(err)

			async.series jobs, callback

buildS3Options = (content, key)->
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

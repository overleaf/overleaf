
fs = require("fs")
mongojs = require("mongojs")
ObjectId = mongojs.ObjectId
db = mongojs('sharelatex', ['projects', 'docs'])
_ = require("underscore")
async = require("async")

local_db_path = "/tmp/process-db"

Datastore = require('nedb')
processDb = new Datastore({ filename: local_db_path})


printProgress = ->
	processDb.count {processed:false}, (err, todo)->
		processDb.count {}, (err, total)->
			console.log "#{todo}/#{total} processed"
			setTimeout printProgress, 1000


writeProjectIdsToDisk = (callback)->
	db.projects.find {}, {_id:1}, (err,ids)->
		console.log "total found projects in mongo #{ids.length}"
		ids = _.map ids, (id)-> return id._id.toString()
		jobs = _.map ids, (id)->
			return (cb)->
				processDb.findOne {project_id:id}, (err, doc)->
					if doc?
						return cb()
					processDb.insert {project_id:id, processed:false}, cb
		async.series jobs, (err)->
			processDb.count {processed:false}, (err, count)->
				console.log "projects to process: #{count}"
				callback()

getNextProjectToProccess = (callback)->
	processDb.findOne {processed:false}, (err, doc)->
		callback err, doc.project_id

markProjectAsProcessed = (project_id, callback)->
	processDb.update project_id:project_id, {$set:{processed:true}}, {}, callback


getAllDocs = (project_id, callback = (error, docs) ->) ->
	db.projects.findOne _id:ObjectId(project_id), (error, project) ->
		return callback(error) if error?
		return callback new Errors.NotFoundError("No such project: #{project_id}") if !project?
		findAllDocsInProject project, (error, docs) ->
			return callback(error) if error?
			return callback null, docs

findAllDocsInProject = (project, callback = (error, docs) ->) ->
	callback null, _findAllDocsInFolder project.rootFolder[0]

_findDocInFolder = (folder = {}, doc_id, currentPath) ->
	for doc, i in folder.docs or []
		if doc?._id? and doc._id.toString() == doc_id.toString()
			return {
				doc: doc
				mongoPath: "#{currentPath}.docs.#{i}"
			}

	for childFolder, i in folder.folders or []
		result = _findDocInFolder childFolder, doc_id, "#{currentPath}.folders.#{i}"
		return result if result?

	return null

_findAllDocsInFolder = (folder = {}) ->
	docs = folder.docs or []
	for childFolder in folder.folders or []
		docs = docs.concat _findAllDocsInFolder childFolder
	return docs

insertDocIntoDocCollection = (project_id, doc_id, lines, oldRev, callback)->
	update = {}
	update["_id"] = ObjectId(doc_id)
	update["lines"] = lines
	update["project_id"] = ObjectId(project_id)
	update["rev"] = oldRev
	db.docs.insert _id: ObjectId(doc_id), callback

saveDocsIntoMongo = (project_id, docs, callback)->
	jobs = _.map docs, (doc)->
		(cb)->
			insertDocIntoDocCollection project_id, doc._id, project_id.lines, doc.rev, cb
	async.series jobs, callback


processNext = ->
	processDb.count {processed:false}, (err, total)->
		if total == 0
			console.log "DONE"
			process.exit()
		else
			getNextProjectToProccess (err, project_id)->
				getAllDocs project_id, (err, docs)->
					saveDocsIntoMongo project_id, docs, ->
						markProjectAsProcessed project_id, ->
							processNext()

processDb.loadDatabase ->
	writeProjectIdsToDisk ->
		processNext()
	
exports.up = (next)->

	next()


exports.down = (next)->
	next()

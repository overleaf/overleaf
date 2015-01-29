
fs = require("fs")
mongojs = require("mongojs")
ObjectId = mongojs.ObjectId
db = mongojs('sharelatex', ['projects', 'docs'])
_ = require("lodash")
async = require("async")
exec = require("child_process").exec

finished_projects_path = "/tmp/finished-projects"


printProgress = ->
	exec "wc #{finished_projects_path}", (error, results) ->
		#console.log results
		setTimeout printProgress, 1000 * 30

checkIfFileHasBeenProccessed = (project_id, callback)->
	exec "grep #{project_id} #{finished_projects_path}", (error, results) ->
		hasBeenProcessed = _.include(results, project_id)
		console.log hasBeenProcessed, project_id
		callback(null, hasBeenProcessed)

getProjectIds = (callback)->
	console.log "finding all project id's - #{new Date().toString()}"
	db.projects.find {}, {_id:1}, (err,ids)->
		console.log "total found projects in mongo #{ids.length} - #{new Date().toString()}"
		ids = _.map ids, (id)-> return id._id.toString()
		callback(err, ids)

markProjectAsProcessed = (project_id, callback)->
	fs.appendFile finished_projects_path, "#{project_id}\n", callback

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


processNext = (project_id, callback)->
	#console.log("starting to process #{project_id} - #{new Date().toString()}")
	checkIfFileHasBeenProccessed project_id, (err, hasBeenProcessed)->
		if hasBeenProcessed
			return callback()
		getAllDocs project_id, (err, docs)->
			if err?
				console.error err, project_id, "could not get all docs"
				return callback()
			saveDocsIntoMongo project_id, docs, ->
				if err?
					console.error err, project_id, "could not save docs into mongo"
					return callback()
				markProjectAsProcessed project_id, ->
					callback()

getProjectIds (err, ids)->
	printProgress()
	jobs = _.map ids, (id)->
		return (cb)->
			processNext(id, cb)
	async.series jobs, (err)->
		if err?
			console.error err, "at end of jobs"
		else
			console.log "finished"
		process.exit()
	
exports.up = (next)->

	next()


exports.down = (next)->
	next()

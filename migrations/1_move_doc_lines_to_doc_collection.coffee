Settings = require "settings-sharelatex"
bson = require('bson')
BSON = new bson()
fs = require("fs")
mongojs = require("mongojs")
ObjectId = mongojs.ObjectId
console.log Settings.mongo.url
db = mongojs(Settings.mongo.url, ['projects', 'docs'])
_ = require("lodash")
async = require("async")
exec = require("child_process").exec

finished_projects_path = "/tmp/finished-projects"
all_projects_path = "/tmp/all-projects"
project_too_large_path = "/tmp/large_projects"


printProgress = ->
	exec "wc #{finished_projects_path}", (error, results) ->
		setTimeout printProgress, 1000 * 30

checkIfFileHasBeenProcessed = (project_id, callback)->
	exec "grep #{project_id} #{finished_projects_path}", (error, results) ->
		hasBeenProcessed = _.include(results, project_id)
		callback(error, hasBeenProcessed)

loadProjectIds = (callback)->
	console.log "loading project ids from #{all_projects_path}"
	fs.readFile all_projects_path, "utf-8", (err, data)->
		ids = data.split("\n")
		ids = _.filter ids, (id)-> id? and id.length == 24
		console.log "loaded #{ids.length} project ids from #{all_projects_path}"
		callback err, ids

getAndWriteProjectids = (callback)->
	console.log "finding all project id's - #{new Date().toString()}"
	db.projects.find {}, {_id:1}, (err, ids)->
		console.log "total found projects in mongo #{ids.length} - #{new Date().toString()}"
		ids = _.pluck ids, '_id'
		ids = _.filter ids, (id)-> id?
		fileData = ids.join("\n")
		fs.writeFile all_projects_path, fileData, ->
			callback(err, ids)

markProjectAsToLargeAndFinished = (project_id, callback)->
	console.log "#{project_id} too large"
	markProjectAsProcessed project_id, (err)->
		fs.appendFile project_too_large_path, "#{project_id}\n", callback

getProjectIds = (callback)->
	exists = fs.existsSync all_projects_path
	if exists
		loadProjectIds callback
	else
		getAndWriteProjectids callback

markProjectAsProcessed = (project_id, callback)->
	fs.appendFile finished_projects_path, "#{project_id}\n", callback

getAllDocs = (project_id, callback = (error, docs) ->) ->
	db.projects.findOne _id:ObjectId(project_id), (error, project) ->
		return callback(error) if error?
		if !project?
			console.log "no such project #{project_id}"
			return callback()
		size = BSON.calculateObjectSize(project)
		if size > 12000000 #12mb
			return markProjectAsToLargeAndFinished project_id, callback
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
	if !project_id?
		return callback("no project id")
	if !doc_id?
		return callback()
	if !lines?
		lines = [""]
	update = {}
	update["_id"] = ObjectId(doc_id.toString())
	update["lines"] = lines
	update["project_id"] = ObjectId(project_id)
	update["rev"] = oldRev || 0
	db.docs.insert update, callback

saveDocsIntoMongo = (project_id, docs, callback)->
	jobs = _.map docs, (doc)->
		(cb)->
			if !doc?
				console.error "null doc in project #{project_id}" #just skip it, not a big deal
				return cb()
			insertDocIntoDocCollection project_id, doc._id, doc.lines, doc.rev, (err)->
				if err?.code == 11000 #duplicate key, doc already in there so its not a problem.
					err = undefined
				if err?
					console.log "error inserting doc into doc collection", err
				cb(err)


	async.series jobs, callback


processNext = (project_id, callback)->
	checkIfFileHasBeenProcessed project_id, (err, hasBeenProcessed)->
		if hasBeenProcessed
			console.log "#{project_id} already processed, skipping"
			return callback()
		console.log "#{project_id} processing"
		getAllDocs project_id, (err, docs)->
			if err?
				console.error err, project_id, "could not get all docs"
				return callback(err)
			else
				saveDocsIntoMongo project_id, docs, (err)->
					if err?
						console.error err, project_id, "could not save docs into mongo"
						return callback(err)
					markProjectAsProcessed project_id, (err)->
						setTimeout(
							-> callback(err)
						,0)



exports.migrate = (client, done = ->)->
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
			done(err)


exports.rollback = (next)->
	next()

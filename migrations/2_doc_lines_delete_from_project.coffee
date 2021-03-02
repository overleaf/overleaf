Settings = require "settings-sharelatex"
fs = require("fs")
mongojs = require("mongojs")
ObjectId = mongojs.ObjectId
db = mongojs(Settings.mongo.url, ['projects', 'docs'])
_ = require("lodash")
async = require("async")
exec = require("child_process").exec

finished_projects_path = "/tmp/finished-projects-2"
all_projects_path = "/tmp/all-projects-2"
unmigrated_docs_path = "/tmp/unmigrated-2"


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

markDocAsUnmigrated = (project_id, doc_id, callback)->
	console.log "#{project_id} #{doc_id} unmigrated"
	markProjectAsProcessed project_id, (err)->
		fs.appendFile unmigrated_docs_path, "#{project_id} #{doc_id}\n", callback

markUnmigratedDocs = (project_id, docs, callback)->
	console.log docs.length, project_id, "unmigrated"
	jobs = _.map docs, (doc)->
		(cb)->
			markDocAsUnmigrated project_id, doc._id, cb
	async.series jobs, callback	

getProjectIds = (callback)->
	exists = fs.existsSync all_projects_path
	if exists
		loadProjectIds callback
	else
		getAndWriteProjectids callback

markProjectAsProcessed = (project_id, callback)->
	fs.appendFile finished_projects_path, "#{project_id}\n", callback

getAllDocs = (project_id, callback = (error, docs) ->) ->
	excludes = {}
	for i in [0..12]
		excludes["rootFolder#{Array(i).join(".folders")}.docs.lines"] = 0
	db.projects.findOne _id: ObjectId(project_id.toString()), excludes, (error, project) ->
		return callback(error) if error?
		if !project?
			console.log "no such project #{project_id}"
			return callback()
		findAllDocsInProject project, (error, docs) ->
			return callback(error) if error?
			return callback null, docs, project

findAllDocsInProject = (project, callback = (error, docs) ->) ->
	callback null, _findAllDocsInFolder project.rootFolder[0]

findDocInProject = (project, doc_id, callback = (error, doc, mongoPath) ->) ->
		result = _findDocInFolder project.rootFolder[0], doc_id, "rootFolder.0"
		if result?
			callback null, result.doc, result.mongoPath
		else
			callback null, null, null

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

isDocInDocCollection = (doc, callback)->
	if !doc?._id? or doc._id.length == 0
		return callback(null, true)
	db.docs.find({_id: ObjectId(doc._id+"")}, {_id: 1}).limit 1, (err, foundDocs)->
		exists = foundDocs.length > 0
		callback err, exists

getWhichDocsCanBeDeleted = (docs, callback = (err, docsToBeDeleted, unmigratedDocs)->)->
	docsToBeDeleted = []
	unmigratedDocs = []

	jobs = _.map docs, (doc)->
		return (cb)->
			isDocInDocCollection doc, (err, exists)->
				if exists
					docsToBeDeleted.push doc
				else
					unmigratedDocs.push doc
				cb(err)
	async.series jobs, (err)->
		callback err, docsToBeDeleted, unmigratedDocs

wipeDocLines = (project_id, mongoPath, callback)->
	update =
		$unset: {}
	update.$unset["#{mongoPath}.lines"] = ""
	update.$unset["#{mongoPath}.rev"] = ""
	db.projects.update _id: ObjectId(project_id+''), update, callback


removeDocLinesFromProject = (docs, project, callback)->
	jobs = _.map docs, (doc)->
		(cb)->
			findDocInProject project, doc._id, (err, doc, mongoPath)->
				wipeDocLines project._id, mongoPath, cb
	async.parallelLimit jobs, 5, callback

processNext = (project_id, callback)->
	if !project_id? or project_id.length == 0
		return callback()
	checkIfFileHasBeenProcessed project_id, (err, hasBeenProcessed)->
		if hasBeenProcessed
			console.log "#{project_id} already processed, skipping"
			return callback()
		console.log "#{project_id} processing"
		getAllDocs project_id, (err, docs, project)->
			if err?
				console.error err, project_id, "could not get all docs"
				return callback(err)
			else
				getWhichDocsCanBeDeleted docs, (err, docsToBeDeleted, unmigratedDocs)->
					if err?
						console.error err, project_id, "could not save docs into mongo"
						return callback(err)
					markUnmigratedDocs project_id, unmigratedDocs, (err)->
						removeDocLinesFromProject docsToBeDeleted, project, (err)->
							if err?
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


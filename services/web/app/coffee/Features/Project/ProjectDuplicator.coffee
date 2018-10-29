projectCreationHandler = require('./ProjectCreationHandler')
ProjectEntityUpdateHandler = require('./ProjectEntityUpdateHandler')
projectLocator = require('./ProjectLocator')
projectOptionsHandler = require('./ProjectOptionsHandler')
projectDeleter = require('./ProjectDeleter')
DocumentUpdaterHandler = require("../DocumentUpdater/DocumentUpdaterHandler")
DocstoreManager = require "../Docstore/DocstoreManager"
ProjectGetter = require("./ProjectGetter")
_ = require('underscore')
async = require('async')
logger = require("logger-sharelatex")


module.exports = ProjectDuplicator =

	_copyDocs: (owner_id, newProject, originalRootDoc, originalFolder, desFolder, docContents, callback)->
		setRootDoc = _.once (doc_id)->
			ProjectEntityUpdateHandler.setRootDoc newProject._id, doc_id
		docs = originalFolder.docs or []
		jobs = docs.map (doc)->
			return (cb)->
				if !doc?._id?
					return callback()
				content = docContents[doc._id.toString()]
				ProjectEntityUpdateHandler.addDoc newProject._id, desFolder._id, doc.name, content.lines, owner_id, (err, newDoc)->
					if err?
						logger.err err:err, "error copying doc"
						return callback(err)
					if originalRootDoc? and newDoc.name == originalRootDoc.name
						setRootDoc newDoc._id
					cb()

		async.series jobs, callback

	_copyFiles: (owner_id, newProject, originalProject_id, originalFolder, desFolder, callback)->
		fileRefs = originalFolder.fileRefs or []
		firstError = null # track first error to exit gracefully from parallel copy
		jobs = fileRefs.map (file)->
			return (cb)->
				return async.setImmediate(cb) if firstError? # skip further copies if an error has occurred
				ProjectEntityUpdateHandler.copyFileFromExistingProjectWithProject newProject, desFolder._id, originalProject_id, file, owner_id, (err) ->
					firstError ||= err if err? # set the error flag if this copy failed
					return cb()
		# If one of these jobs fails then we wait until all running jobs have
		# finished, skipping those which have not started yet. We need to wait
		# for all the copy jobs to finish to avoid them writing to the project
		# entry in the background while we are deleting it.
		async.parallelLimit jobs, 5, (err) ->
			return callback(firstError) if firstError?
			return callback(err) if err? # shouldn't happen
			return callback()


	_copyFolderRecursivly: (owner_id, newProject_id, originalProject_id, originalRootDoc, originalFolder, desFolder, docContents, callback)->
		ProjectGetter.getProject newProject_id, {rootFolder:true, name:true}, (err, newProject)->
			if err?
				logger.err project_id:newProject_id, "could not get project"
				return callback(err)

			folders = originalFolder.folders or []

			jobs = folders.map (childFolder)->
				return (cb)->
					if !childFolder?._id?
						return cb()
					ProjectEntityUpdateHandler.addFolder newProject._id, desFolder?._id, childFolder.name, (err, newFolder)->
						return cb(err) if err?
						ProjectDuplicator._copyFolderRecursivly owner_id, newProject_id, originalProject_id, originalRootDoc, childFolder, newFolder, docContents, cb

			jobs.push (cb)->
				ProjectDuplicator._copyFiles owner_id, newProject, originalProject_id, originalFolder, desFolder, cb
			jobs.push (cb)->
				ProjectDuplicator._copyDocs owner_id, newProject, originalRootDoc, originalFolder, desFolder, docContents, cb

			async.series jobs, callback

	duplicate: (owner, originalProject_id, newProjectName, callback)->

		jobs = 
			flush: (cb)->
				DocumentUpdaterHandler.flushProjectToMongo originalProject_id, cb
			originalProject: (cb)->
				ProjectGetter.getProject originalProject_id, {compiler:true, rootFolder:true, rootDoc_id:true}, cb
			originalRootDoc: (cb)->
				projectLocator.findRootDoc {project_id:originalProject_id}, cb
			docContentsArray: (cb)-> 
				DocstoreManager.getAllDocs originalProject_id, cb

		# Get the contents of the original project first
		async.series jobs, (err, results)->
			if err?
				logger.err err:err, originalProject_id:originalProject_id, "error duplicating project reading original project"
				return callback(err)
			{originalProject, originalRootDoc, docContentsArray} = results

			originalRootDoc = originalRootDoc?[0]

			docContents = {}
			for docContent in docContentsArray
				docContents[docContent._id] = docContent

			# Now create the new project, cleaning it up on failure if necessary
			projectCreationHandler.createBlankProject owner._id, newProjectName, (err, newProject) ->
				if err?
					logger.err err:err, originalProject_id:originalProject_id, "error duplicating project when creating new project"
					return callback(err)

				copyJobs =
					setCompiler: (cb) ->
						projectOptionsHandler.setCompiler newProject._id, originalProject.compiler, cb
					copyFiles: (cb) ->
						ProjectDuplicator._copyFolderRecursivly owner._id, newProject._id, originalProject_id, originalRootDoc, originalProject.rootFolder[0], newProject.rootFolder[0], docContents, cb

				# Copy the contents of the original project into the new project
				async.series copyJobs, (err) ->
					if err?
						logger.err err:err, originalProject_id:originalProject_id, newProjectName:newProjectName, newProject_id: newProject._id, "error cloning project, will delete broken clone"
						# Clean up broken clone on error.
						# Make sure we delete the new failed project, not the original one!
						projectDeleter.deleteProject newProject._id, (delete_err) ->
							if delete_err?
								logger.error newProject_id: newProject._id, delete_err:delete_err, "error deleting broken clone of project"
							callback(err)
					else
						callback(null, newProject)

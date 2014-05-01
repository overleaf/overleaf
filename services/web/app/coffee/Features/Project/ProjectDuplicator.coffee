projectCreationHandler = require('./ProjectCreationHandler')
projectEntityHandler = require('./ProjectEntityHandler')
projectLocator = require('./ProjectLocator')
projectOptionsHandler = require('./ProjectOptionsHandler')
DocumentUpdaterHandler = require("../DocumentUpdater/DocumentUpdaterHandler")
Project = require("../../models/Project").Project
_ = require('underscore')
async = require('async')

module.exports =
	duplicate: (owner, originalProjectId, newProjectName, callback)->
		DocumentUpdaterHandler.flushProjectToMongo originalProjectId, (err) ->
			return callback(err) if err?
			Project.findById originalProjectId, (err, originalProject) ->
				return callback(err) if err?
				projectCreationHandler.createBlankProject owner._id, newProjectName, (err, newProject)->
					return callback(err) if err?
					projectLocator.findRootDoc {project:originalProject}, (err, originalRootDoc)->
						projectOptionsHandler.setCompiler newProject._id, originalProject.compiler

						setRootDoc = _.once (doc_id)->
							projectEntityHandler.setRootDoc newProject, doc_id

						copyDocs = (originalFolder, newParentFolder, callback)->
							jobs = originalFolder.docs.map (doc)->
								return (callback)->
									projectEntityHandler.addDoc newProject, newParentFolder._id, doc.name, doc.lines, (err, newDoc)->
										if originalRootDoc? and newDoc.name == originalRootDoc.name
											setRootDoc newDoc._id
										callback()
							async.series jobs, callback

						copyFiles = (originalFolder, newParentFolder, callback)->
							jobs = originalFolder.fileRefs.map (file)->
								return (callback)->
									projectEntityHandler.copyFileFromExistingProject newProject, newParentFolder._id, originalProject._id, file, callback
							async.parallelLimit jobs, 5, callback

						copyFolder = (folder, desFolder, callback)->
							jobs = folder.folders.map (childFolder)->
								return (callback)->
									projectEntityHandler.addFolder newProject, desFolder._id, childFolder.name, (err, newFolder)->
										copyFolder childFolder, newFolder, callback
							jobs.push (cb)->
								copyDocs folder, desFolder, cb
							jobs.push (cb)->
								copyFiles folder, desFolder, cb

							async.series jobs, callback

						copyFolder originalProject.rootFolder[0], newProject.rootFolder[0], ->
							callback(err, newProject)


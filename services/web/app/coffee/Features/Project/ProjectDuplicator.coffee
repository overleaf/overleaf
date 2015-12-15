projectCreationHandler = require('./ProjectCreationHandler')
projectEntityHandler = require('./ProjectEntityHandler')
projectLocator = require('./ProjectLocator')
projectOptionsHandler = require('./ProjectOptionsHandler')
DocumentUpdaterHandler = require("../DocumentUpdater/DocumentUpdaterHandler")
DocstoreManager = require "../Docstore/DocstoreManager"
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
						return callback(err) if err?
						DocstoreManager.getAllDocs originalProjectId, (err, docContentsArray) ->
							return callback(err) if err?

							docContents = {}
							for docContent in docContentsArray
								docContents[docContent._id] = docContent

							projectOptionsHandler.setCompiler newProject._id, originalProject.compiler

							setRootDoc = _.once (doc_id)->
								projectEntityHandler.setRootDoc newProject, doc_id

							copyDocs = (originalFolder, newParentFolder, callback)->
								jobs = originalFolder.docs.map (doc)->
									return (callback)->
										content = docContents[doc._id.toString()]
										return callback(new Error("doc_id not found: #{doc._id}")) if !content?
										projectEntityHandler.addDoc newProject._id, newParentFolder._id, doc.name, content.lines, (err, newDoc)->
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


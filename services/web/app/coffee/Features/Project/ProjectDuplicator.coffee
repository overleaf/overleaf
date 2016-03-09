projectCreationHandler = require('./ProjectCreationHandler')
projectEntityHandler = require('./ProjectEntityHandler')
projectLocator = require('./ProjectLocator')
projectOptionsHandler = require('./ProjectOptionsHandler')
DocumentUpdaterHandler = require("../DocumentUpdater/DocumentUpdaterHandler")
DocstoreManager = require "../Docstore/DocstoreManager"
ProjectGetter = require("./ProjectGetter")
_ = require('underscore')
async = require('async')
logger = require("logger-sharelatex")


module.exports =
	duplicate: (owner, originalProjectId, newProjectName, callback)->
		DocumentUpdaterHandler.flushProjectToMongo originalProjectId, (err) ->
			return callback(err) if err?
			ProjectGetter.getProject originalProjectId, {compiler:true, rootFolder:true, rootDoc_id:true}, (err, originalProject) ->
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
										projectEntityHandler.addDocWithProject newProject, newParentFolder._id, doc.name, content.lines, (err, newDoc)->
											if err?
												logger.err err:err, originalProjectId:originalProjectId, newProjectName:newProjectName, "error adding doc"
												return callback(err)
											if originalRootDoc? and newDoc.name == originalRootDoc.name
												setRootDoc newDoc._id
											callback()
								async.series jobs, callback

							copyFiles = (originalFolder, newParentFolder, callback)->
								jobs = originalFolder.fileRefs.map (file)->
									return (callback)->
										projectEntityHandler.copyFileFromExistingProjectWithProject newProject, newParentFolder._id, originalProject._id, file, callback
								async.parallelLimit jobs, 5, callback

							copyFolder = (folder, desFolder, callback)->
								jobs = folder.folders.map (childFolder)->
									return (callback)->
										projectEntityHandler.addFolderWithProject newProject, desFolder._id, childFolder.name, (err, newFolder)->
											copyFolder childFolder, newFolder, callback
								jobs.push (cb)->
									copyDocs folder, desFolder, cb
								jobs.push (cb)->
									copyFiles folder, desFolder, cb

								async.series jobs, callback

							copyFolder originalProject.rootFolder[0], newProject.rootFolder[0], (err)->
								if err?
									logger.err err:err, originalProjectId:originalProjectId,  newProjectName:newProjectName, "error cloning project"
								callback(err, newProject)


_ = require('underscore')
async = require "async"
path = require "path"
logger = require('logger-sharelatex')
DocstoreManager = require "../Docstore/DocstoreManager"
DocumentUpdaterHandler = require('../../Features/DocumentUpdater/DocumentUpdaterHandler')
Errors = require '../Errors/Errors'
Project = require('../../models/Project').Project
ProjectGetter = require "./ProjectGetter"
TpdsUpdateSender = require('../ThirdPartyDataStore/TpdsUpdateSender')

module.exports = ProjectEntityHandler = self =
	getAllDocs: (project_id, callback) ->
		logger.log project_id:project_id, "getting all docs for project"

		# We get the path and name info from the project, and the lines and
		# version info from the doc store.
		DocstoreManager.getAllDocs project_id, (error, docContentsArray) ->
			return callback(error) if error?

			# Turn array from docstore into a dictionary based on doc id
			docContents = {}
			for docContent in docContentsArray
				docContents[docContent._id] = docContent

			self._getAllFolders project_id, (error, folders = {}) ->
				return callback(error) if error?
				docs = {}
				for folderPath, folder of folders
					for doc in (folder.docs or [])
						content = docContents[doc._id.toString()]
						if content?
							docs[path.join(folderPath, doc.name)] = {
								_id:   doc._id
								name:  doc.name
								lines: content.lines
								rev:   content.rev
							}
				logger.log count:_.keys(docs).length, project_id:project_id, "returning docs for project"
				callback null, docs

	getAllFiles: (project_id, callback) ->
		logger.log project_id:project_id, "getting all files for project"
		self._getAllFolders project_id, (err, folders = {}) ->
			return callback(err) if err?
			files = {}
			for folderPath, folder of folders
				for file in (folder.fileRefs or [])
					if file?
						files[path.join(folderPath, file.name)] = file
			callback null, files

	getAllEntitiesFromProject: (project, callback) ->
		logger.log project:project, "getting all entities for project"
		self._getAllFoldersFromProject project, (err, folders = {}) ->
			return callback(err) if err?
			docs = []
			files = []
			for folderPath, folder of folders
				for doc in (folder.docs or [])
					if doc?
						docs.push({path: path.join(folderPath, doc.name), doc:doc})
				for file in (folder.fileRefs or [])
					if file?
						files.push({path: path.join(folderPath, file.name), file:file})
			callback null, docs, files

	getAllDocPathsFromProjectById: (project_id, callback) ->
		ProjectGetter.getProjectWithoutDocLines project_id, (err, project) ->
			return callback(err) if err?
			return callback(Errors.NotFoundError("no project")) if !project?
			self.getAllDocPathsFromProject project, callback

	getAllDocPathsFromProject: (project, callback) ->
		logger.log project:project, "getting all docs for project"
		self._getAllFoldersFromProject project, (err, folders = {}) ->
			return callback(err) if err?
			docPath = {}
			for folderPath, folder of folders
				for doc in (folder.docs or [])
					docPath[doc._id] = path.join(folderPath, doc.name)
			logger.log count:_.keys(docPath).length, project_id:project._id, "returning docPaths for project"
			callback null, docPath

	flushProjectToThirdPartyDataStore: (project_id, callback) ->
		logger.log project_id:project_id, "flushing project to tpds"
		DocumentUpdaterHandler.flushProjectToMongo project_id, (error) ->
			return callback(error) if error?
			ProjectGetter.getProject project_id, {name:true}, (error, project) ->
				return callback(error) if error?
				requests = []
				self.getAllDocs project_id, (error, docs) ->
					return callback(error) if error?
					for docPath, doc of docs
						do (docPath, doc) ->
							requests.push (cb) ->
								TpdsUpdateSender.addDoc {project_id:project_id, doc_id:doc._id, path:docPath, project_name:project.name, rev:doc.rev||0}, cb
					self.getAllFiles project_id, (error, files) ->
						return callback(error) if error?
						for filePath, file of files
							do (filePath, file) ->
								requests.push (cb) ->
									TpdsUpdateSender.addFile {project_id:project_id, file_id:file._id, path:filePath, project_name:project.name, rev:file.rev}, cb
						async.series requests, (err) ->
							logger.log project_id:project_id, "finished flushing project to tpds"
							callback(err)

	getDoc: (project_id, doc_id, options = {}, callback = (error, lines, rev) ->) ->
		if typeof(options) == "function"
			callback = options
			options = {}

		DocstoreManager.getDoc project_id, doc_id, options, callback

	_getAllFolders: (project_id,  callback) ->
		logger.log project_id:project_id, "getting all folders for project"
		ProjectGetter.getProjectWithoutDocLines project_id, (err, project) ->
			return callback(err) if err?
			return callback(Errors.NotFoundError("no project")) if !project?
			self._getAllFoldersFromProject project, callback

	_getAllFoldersFromProject: (project, callback) ->
		folders = {}
		processFolder = (basePath, folder) ->
			folders[basePath] = folder
			for childFolder in (folder.folders or [])
				if childFolder.name?
					processFolder path.join(basePath, childFolder.name), childFolder

		processFolder "/", project.rootFolder[0]
		callback null, folders

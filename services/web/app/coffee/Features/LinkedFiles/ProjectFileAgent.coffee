AuthorizationManager = require('../Authorization/AuthorizationManager')
ProjectLocator = require('../Project/ProjectLocator')
ProjectGetter = require('../Project/ProjectGetter')
DocstoreManager = require('../Docstore/DocstoreManager')
DocumentUpdaterHandler = require('../DocumentUpdater/DocumentUpdaterHandler')
FileStoreHandler = require('../FileStore/FileStoreHandler')
_ = require "underscore"
Settings = require 'settings-sharelatex'
LinkedFilesHandler = require './LinkedFilesHandler'
{
	BadDataError,
	AccessDeniedError,
	BadEntityTypeError,
	SourceFileNotFoundError,
	ProjectNotFoundError,
	V1ProjectNotFoundError
} = require './LinkedFilesErrors'

module.exports = ProjectFileAgent = {

	createLinkedFile: (project_id, linkedFileData, name, parent_folder_id, user_id, callback) ->
		if !@_canCreate(linkedFileData)
			return callback(new AccessDeniedError())
		@_go(project_id, linkedFileData, name, parent_folder_id, user_id, callback)

	refreshLinkedFile: (project_id, linkedFileData, name, parent_folder_id, user_id, callback) ->
		@_go project_id, linkedFileData, name, parent_folder_id, user_id, callback

	_prepare: (project_id, linkedFileData, user_id, callback=(err, linkedFileData)->) ->
		@_checkAuth project_id, linkedFileData, user_id, (err, allowed) =>
			return callback(err) if err?
			return callback(new AccessDeniedError()) if !allowed
			if !@_validate(linkedFileData)
				return callback(new BadDataError())
			callback(null, linkedFileData)

	_go: (project_id, linkedFileData, name, parent_folder_id, user_id, callback) ->
		linkedFileData = @_sanitizeData(linkedFileData)
		@_prepare project_id, linkedFileData, user_id, (err, linkedFileData) =>
			return callback(err) if err?
			if !@_validate(linkedFileData)
				return callback(new BadDataError())
			@_getEntity linkedFileData, user_id, (err, source_project, entity, type) =>
				return callback(err) if err?
				if type == 'doc'
					DocstoreManager.getDoc source_project._id, entity._id, (err, lines) ->
						return callback(err) if err?
						LinkedFilesHandler.importContent project_id,
							lines.join('\n'),
							linkedFileData,
							name,
							parent_folder_id,
							user_id,
							(err, file) ->
								return callback(err) if err?
								callback(null, file._id) # Created
				else if type == 'file'
					FileStoreHandler.getFileStream source_project._id, entity._id, null, (err, fileStream) ->
						return callback(err) if err?
						LinkedFilesHandler.importFromStream project_id,
							fileStream,
							linkedFileData,
							name,
							parent_folder_id,
							user_id,
							(err, file) ->
								return callback(err) if err?
								callback(null, file._id) # Created
				else
					callback(new BadEntityTypeError())

	_getEntity:
		(linkedFileData, current_user_id, callback = (err, entity, type) ->) ->
			callback = _.once(callback)
			{ source_entity_path } = linkedFileData
			@_getSourceProject linkedFileData, (err, project) ->
				return callback(err) if err?
				source_project_id = project._id
				DocumentUpdaterHandler.flushProjectToMongo source_project_id, (err) ->
					return callback(err) if err?
					ProjectLocator.findElementByPath {
						project_id: source_project_id,
						path: source_entity_path
					}, (err, entity, type) ->
						if err?
							if /^not found.*/.test(err.toString())
								err = new SourceFileNotFoundError()
							return callback(err)
						callback(null, project, entity, type)

	_sanitizeData: (data) ->
		return _.pick(
			data,
			'provider',
			'source_project_id',
			'v1_source_doc_id',
			'source_entity_path'
		)

	_validate: (data) ->
		return (
			(data.source_project_id? || data.v1_source_doc_id?) &&
			data.source_entity_path?
		)

	_canCreate: (data) ->
		# Don't allow creation of linked-files with v1 doc ids
		!data.v1_source_doc_id?

	_getSourceProject: LinkedFilesHandler.getSourceProject

	_checkAuth: (project_id, data, current_user_id, callback = (error, allowed)->) ->
		callback = _.once(callback)
		if !ProjectFileAgent._validate(data)
			return callback(new BadDataError())
		@_getSourceProject data, (err, project) ->
			return callback(err) if err?
			AuthorizationManager.canUserReadProject current_user_id, project._id, null, (err, canRead) ->
				return callback(err) if err?
				callback(null, canRead)
}

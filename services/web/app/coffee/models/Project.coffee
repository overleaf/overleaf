mongoose = require('mongoose')
Settings = require 'settings-sharelatex'
_ = require('underscore')
FolderSchema = require('./Folder.js').FolderSchema
logger = require('logger-sharelatex')
sanitize = require('sanitizer')
concreteObjectId = require('mongoose').Types.ObjectId
Errors  = require "../Features/Errors/Errors"


Schema = mongoose.Schema
ObjectId = Schema.ObjectId

DeletedDocSchema = new Schema
	name: String

ProjectSchema = new Schema
	name              :   {type:String, default:'new project'}
	lastUpdated       :   {type:Date, default: () -> new Date()}
	lastOpened		  :   {type:Date}
	active			  :   { type: Boolean,  default: true }
	owner_ref         :   {type:ObjectId, ref:'User'}
	collaberator_refs :   [ type:ObjectId, ref:'User' ]
	readOnly_refs     :   [ type:ObjectId, ref:'User' ]
	rootDoc_id        :   {type: ObjectId}
	rootFolder        :   [FolderSchema]
	publicAccesLevel  :   {type: String, default: 'private'}
	compiler		  :   {type:String, default:'pdflatex'}
	spellCheckLanguage :   {type:String, default:'en'}
	deletedByExternalDataSource : {type: Boolean, default: false}
	description : {type:String, default:''}
	archived          : { type: Boolean }
	deletedDocs       : [DeletedDocSchema]
	imageName         : { type: String }
	track_changes     : { type: Boolean }

ProjectSchema.statics.getProject = (project_or_id, fields, callback)->
	if project_or_id._id?
		callback null, project_or_id
	else
		try
			concreteObjectId(project_or_id.toString())
		catch e
			return callback(new Errors.NotFoundError(e.message))
		this.findById project_or_id, fields, callback

applyToAllFilesRecursivly = ProjectSchema.statics.applyToAllFilesRecursivly = (folder, fun)->
	_.each folder.fileRefs, (file)->
		fun(file)
	_.each folder.folders, (folder)->
		applyToAllFilesRecursivly(folder, fun)


ProjectSchema.methods.getSafeProjectName = ->
	safeProjectName = this.name.replace(new RegExp("\\W", "g"), '_')
	return sanitize.escape(safeProjectName)

conn = mongoose.createConnection(Settings.mongo.url, server: poolSize: Settings.mongo.poolSize || 10)

Project = conn.model('Project', ProjectSchema)

mongoose.model 'Project', ProjectSchema
exports.Project = Project
exports.ProjectSchema = ProjectSchema

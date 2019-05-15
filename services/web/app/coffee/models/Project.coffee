mongoose = require('mongoose')
Settings = require 'settings-sharelatex'
_ = require('underscore')
FolderSchema = require('./Folder.js').FolderSchema
logger = require('logger-sharelatex')
concreteObjectId = require('mongoose').Types.ObjectId
Errors  = require "../Features/Errors/Errors"

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

DeletedDocSchema = new Schema
	name: String

DeletedFileSchema = new Schema
	name           : String
	created        : type:Date
	linkedFileData : { type: Schema.Types.Mixed }
	hash           : type:String
	deletedAt      : {type: Date}

ProjectSchema = new Schema
	name              :   {type:String, default:'new project'}
	lastUpdated       :   {type:Date, default: () -> new Date()}
	lastUpdatedBy     :   {type:ObjectId, ref: 'User'}
	lastOpened        :   {type:Date}
	active            :   { type: Boolean,  default: true }
	owner_ref         :   {type:ObjectId, ref:'User'}
	collaberator_refs :   [ type:ObjectId, ref:'User' ]
	readOnly_refs     :   [ type:ObjectId, ref:'User' ]
	rootDoc_id        :   {type: ObjectId}
	rootFolder        :   [FolderSchema]
	version           :   {type: Number} # incremented for every change in the project structure (folders and filenames)
	publicAccesLevel  :   {type: String, default: 'private'}
	compiler          :   {type:String, default:'pdflatex'}
	spellCheckLanguage :   {type:String, default:'en'}
	deletedByExternalDataSource : {type: Boolean, default: false}
	description : {type:String, default:''}
	archived          : { type: Boolean }
	deletedDocs       : [DeletedDocSchema]
	deletedFiles      : [DeletedFileSchema]
	imageName         : { type: String }
	brandVariationId  : { type: String }
	track_changes     : { type: Object }
	tokens            :
		readOnly        : {
			type: String,
			index: {
				unique: true,
				partialFilterExpression: {'tokens.readOnly': {$exists: true}}
			}
		}
		readAndWrite    : {
			type: String,
			index: {
				unique: true,
				partialFilterExpression: {'tokens.readAndWrite': {$exists: true}}
			}
		}
		readAndWritePrefix: {
			type: String,
			index: {
				unique: true,
				partialFilterExpression: {'tokens.readAndWritePrefix': {$exists: true}}
			}
		}
	tokenAccessReadOnly_refs         : [ type:ObjectId, ref:'User' ]
	tokenAccessReadAndWrite_refs     : [ type:ObjectId, ref:'User' ]
	fromV1TemplateId: { type: Number }
	fromV1TemplateVersionId: { type: Number }
	overleaf          :
		id              : { type: Number }
		imported_at_ver_id : { type: Number }
		token           : { type: String }
		read_token      : { type: String }
		history         :
			id            : { type: Number }
			display       : { type: Boolean }
			upgradedAt    : { type: Date }
	collabratecUsers	: [
		{
			user_id						: { type: ObjectId, ref:'User' }
			collabratec_document_id		: { type: String }
			collabratec_privategroup_id	: { type: String }
			added_at					: { type: Date, default: () -> new Date() }
		}
	]

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

conn = mongoose.createConnection(Settings.mongo.url, {
	server: {poolSize: Settings.mongo.poolSize || 10},
	config: {autoIndex: false}
})

Project = conn.model('Project', ProjectSchema)

mongoose.model 'Project', ProjectSchema
exports.Project = Project
exports.ProjectSchema = ProjectSchema

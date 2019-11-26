const mongoose = require('../infrastructure/Mongoose')
const _ = require('underscore')
const { FolderSchema } = require('./Folder.js')
const Errors = require('../Features/Errors/Errors')

const concreteObjectId = mongoose.Types.ObjectId
const { Schema } = mongoose
const { ObjectId } = Schema

const DeletedDocSchema = new Schema({
  name: String,
  deletedAt: { type: Date }
})

const DeletedFileSchema = new Schema({
  name: String,
  created: {
    type: Date
  },
  linkedFileData: { type: Schema.Types.Mixed },
  hash: {
    type: String
  },
  deletedAt: { type: Date }
})

const AuditLogEntrySchema = new Schema({
  _id: false,
  operation: { type: String },
  initiatorId: { type: Schema.Types.ObjectId },
  timestamp: { type: Date },
  info: { type: Object }
})

const ProjectSchema = new Schema({
  name: { type: String, default: 'new project' },
  lastUpdated: {
    type: Date,
    default() {
      return new Date()
    }
  },
  lastUpdatedBy: { type: ObjectId, ref: 'User' },
  lastOpened: { type: Date },
  active: { type: Boolean, default: true },
  owner_ref: { type: ObjectId, ref: 'User' },
  collaberator_refs: [{ type: ObjectId, ref: 'User' }],
  readOnly_refs: [{ type: ObjectId, ref: 'User' }],
  rootDoc_id: { type: ObjectId },
  rootFolder: [FolderSchema],
  version: { type: Number }, // incremented for every change in the project structure (folders and filenames)
  publicAccesLevel: { type: String, default: 'private' },
  compiler: { type: String, default: 'pdflatex' },
  spellCheckLanguage: { type: String, default: 'en' },
  deletedByExternalDataSource: { type: Boolean, default: false },
  description: { type: String, default: '' },
  archived: { type: Schema.Types.Mixed },
  trashed: [{ type: ObjectId, ref: 'User' }],
  deletedDocs: [DeletedDocSchema],
  deletedFiles: [DeletedFileSchema],
  imageName: { type: String },
  brandVariationId: { type: String },
  track_changes: { type: Object },
  tokens: {
    readOnly: {
      type: String,
      index: {
        unique: true,
        partialFilterExpression: { 'tokens.readOnly': { $exists: true } }
      }
    },
    readAndWrite: {
      type: String,
      index: {
        unique: true,
        partialFilterExpression: { 'tokens.readAndWrite': { $exists: true } }
      }
    },
    readAndWritePrefix: {
      type: String,
      index: {
        unique: true,
        partialFilterExpression: {
          'tokens.readAndWritePrefix': { $exists: true }
        }
      }
    }
  },
  tokenAccessReadOnly_refs: [{ type: ObjectId, ref: 'User' }],
  tokenAccessReadAndWrite_refs: [{ type: ObjectId, ref: 'User' }],
  fromV1TemplateId: { type: Number },
  fromV1TemplateVersionId: { type: Number },
  overleaf: {
    id: { type: Number },
    imported_at_ver_id: { type: Number },
    token: { type: String },
    read_token: { type: String },
    history: {
      id: { type: Number },
      display: { type: Boolean },
      upgradedAt: { type: Date }
    }
  },
  collabratecUsers: [
    {
      user_id: { type: ObjectId, ref: 'User' },
      collabratec_document_id: { type: String },
      collabratec_privategroup_id: { type: String },
      added_at: {
        type: Date,
        default() {
          return new Date()
        }
      }
    }
  ],
  auditLog: [AuditLogEntrySchema],
  deferredTpdsFlushCounter: { type: Number }
})

ProjectSchema.statics.getProject = function(projectOrId, fields, callback) {
  if (projectOrId._id != null) {
    callback(null, projectOrId)
  } else {
    try {
      concreteObjectId(projectOrId.toString())
    } catch (e) {
      return callback(new Errors.NotFoundError(e.message))
    }
    this.findById(projectOrId, fields, callback)
  }
}

function applyToAllFilesRecursivly(folder, fun) {
  _.each(folder.fileRefs, file => fun(file))
  _.each(folder.folders, folder => applyToAllFilesRecursivly(folder, fun))
}
ProjectSchema.statics.applyToAllFilesRecursivly = applyToAllFilesRecursivly

exports.Project = mongoose.model('Project', ProjectSchema)
exports.ProjectSchema = ProjectSchema

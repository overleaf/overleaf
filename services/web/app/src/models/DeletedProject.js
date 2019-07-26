// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')
const { ProjectSchema } = require('./Project')

const { Schema } = mongoose
const { ObjectId } = Schema

const DeleterDataSchema = new Schema({
  deleterId: { type: ObjectId, ref: 'User' },
  deleterIpAddress: { type: String },
  deletedAt: { type: Date },
  deletedProjectId: { type: ObjectId },
  deletedProjectOwnerId: { type: ObjectId, ref: 'User' },
  deletedProjectCollaboratorIds: [{ type: ObjectId, ref: 'User' }],
  deletedProjectReadOnlyIds: [{ type: ObjectId, ref: 'User' }],
  deletedProjectReadWriteTokenAccessIds: [{ type: ObjectId, ref: 'User' }],
  deletedProjectReadOnlyTokenAccessIds: [{ type: ObjectId, ref: 'User' }],
  deletedProjectReadWriteToken: { type: String },
  deletedProjectReadOnlyToken: { type: String },
  deletedProjectLastUpdatedAt: { type: Date },
  deletedProjectOverleafId: { type: Number },
  deletedProjectOverleafHistoryId: { type: Number }
})

const DeletedProjectSchema = new Schema(
  {
    deleterData: DeleterDataSchema,
    project: ProjectSchema
  },
  { collection: 'deletedProjects' }
)

const conn = mongoose.createConnection(Settings.mongo.url, {
  server: { poolSize: Settings.mongo.poolSize || 10 },
  config: { autoIndex: false }
})

const DeletedProject = conn.model('DeletedProject', DeletedProjectSchema)

mongoose.model('DeletedProject', DeletedProjectSchema)
exports.DeletedProject = DeletedProject
exports.DeletedProjectSchema = DeletedProjectSchema

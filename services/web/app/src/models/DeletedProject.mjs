import mongoose from '../infrastructure/Mongoose.mjs'
import { ProjectSchema } from './Project.mjs'

const { Schema } = mongoose
const { ObjectId } = Schema

export const DeleterDataSchema = new Schema({
  deleterId: { type: ObjectId, ref: 'User' },
  deleterIpAddress: { type: String },
  deletedAt: { type: Date },
  deletedProjectId: { type: ObjectId },
  deletedProjectOwnerId: { type: ObjectId, ref: 'User' },
  deletedProjectCollaboratorIds: [{ type: ObjectId, ref: 'User' }],
  deletedProjectReadOnlyIds: [{ type: ObjectId, ref: 'User' }],
  deletedProjectReviewerIds: [{ type: ObjectId, ref: 'User' }],
  deletedProjectReadWriteTokenAccessIds: [{ type: ObjectId, ref: 'User' }],
  deletedProjectReadOnlyTokenAccessIds: [{ type: ObjectId, ref: 'User' }],
  deletedProjectReadWriteToken: { type: String },
  deletedProjectReadOnlyToken: { type: String },
  deletedProjectLastUpdatedAt: { type: Date },
  deletedProjectOverleafId: { type: Number },
  deletedProjectOverleafHistoryId: { type: Schema.Types.Mixed },
})

const DeletedProjectSchema = new Schema(
  {
    deleterData: DeleterDataSchema,
    project: ProjectSchema,
  },
  { collection: 'deletedProjects', minimize: false }
)

export const DeletedProject = mongoose.model(
  'DeletedProject',
  DeletedProjectSchema
)

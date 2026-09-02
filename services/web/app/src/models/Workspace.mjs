import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

export const MAX_WORKSPACE_NAME_LENGTH = 150

export const WorkspaceSchema = new Schema(
  {
    subscription_id: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    name: { type: String, maxlength: MAX_WORKSPACE_NAME_LENGTH },
    privilegeLevel: {
      type: String,
      enum: ['readOnly', 'review', 'readAndWrite'],
      default: 'readOnly',
    },
  },
  {
    collection: 'workspaces',
    minimize: false,
  }
)

export const Workspace = mongoose.model('Workspace', WorkspaceSchema)

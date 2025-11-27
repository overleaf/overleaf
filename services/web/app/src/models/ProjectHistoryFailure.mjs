import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

const ProjectHistoryFailureSchema = new Schema(
  {
    project_id: String,
    ts: Date,
    queueSize: Number,
    error: String,
    stack: String,
    attempts: Number,
    history: Schema.Types.Mixed,
    resyncStartedAt: Date,
    resyncAttempts: Number,
    requestCount: Number,
  },
  { collection: 'projectHistoryFailures', minimize: false }
)

export const ProjectHistoryFailure = mongoose.model(
  'ProjectHistoryFailure',
  ProjectHistoryFailureSchema
)

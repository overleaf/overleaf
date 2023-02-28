const mongoose = require('../infrastructure/Mongoose')

const { Schema } = mongoose

const ProjectHistoryFailureSchema = new Schema(
  {
    project_id: Schema.Types.ObjectId,
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

exports.ProjectHistoryFailure = mongoose.model(
  'ProjectHistoryFailure',
  ProjectHistoryFailureSchema
)

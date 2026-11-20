import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

export const PackageHubJobSchema = new Schema(
  {
    jobId: { type: String, required: true, unique: true, index: true },
    type: {
      type: String,
      enum: ['install', 'remove', 'update', 'upload', 'community-install', 'snapshot', 'reconcile'],
      required: true,
    },
    payload: { type: Schema.Types.Mixed, default: {} },
    status: {
      type: String,
      enum: ['queued', 'running', 'success', 'failed'],
      default: 'queued',
      index: true,
    },
    progress: { type: Number, default: 0 },
    phase: { type: String, default: 'Queued' },
    log: { type: [String], default: [] },
    error: { type: String, default: null },
    started_at: { type: Date, default: null },
    finished_at: { type: Date, default: null },
    created_by: { type: String, default: 'system' },
    created_at: { type: Date, default: () => new Date() },
  },
  { collection: 'packageHubJobs' }
)

export const PackageHubJob = mongoose.model('PackageHubJob', PackageHubJobSchema)

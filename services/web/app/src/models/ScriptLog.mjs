import Mongoose from '../infrastructure/Mongoose.mjs'

export const ScriptLogSchema = new Mongoose.Schema(
  {
    canonicalName: { type: String, required: true },
    filePathAtVersion: { type: String, required: true },
    imageVersion: { type: String, required: true },
    podName: { type: String, required: true },
    startTime: { type: Date, default: Date.now },
    endTime: { type: Date, default: null },
    username: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'success', 'error'],
      default: 'pending',
      required: true,
    },
    vars: { type: Object, required: true },
    progressLogs: {
      type: [{ timestamp: Date, message: String }],
      required: true,
    },
  },
  { minimize: false, collection: 'scriptLogs' }
)

export const ScriptLog = Mongoose.model('ScriptLog', ScriptLogSchema)

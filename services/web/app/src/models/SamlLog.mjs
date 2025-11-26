import mongoose from '../infrastructure/Mongoose.js'
const { Schema } = mongoose

export const SamlLogSchema = new Schema(
  {
    createdAt: { type: Date, default: () => new Date() },
    data: { type: Object },
    jsonData: { type: String },
    path: { type: String },
    providerId: { type: String, default: '' },
    samlAssertion: { type: String },
    sessionId: { type: String, default: '' },
    userId: { type: String, default: '' },
  },
  {
    collection: 'samlLogs',
    minimize: false,
  }
)

export const SamlLog = mongoose.model('SamlLog', SamlLogSchema)

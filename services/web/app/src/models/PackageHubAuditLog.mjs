import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

export const PackageHubAuditLogSchema = new Schema(
  {
    user_id: { type: String, required: true, index: true },
    user_email: { type: String, default: '' },
    action: { type: String, required: true, index: true },
    package_name: { type: String, required: true, index: true },
    source: { type: String, default: 'texlive' },
    result: { type: String, required: true },
    details: { type: String, default: '' },
    timestamp: { type: Date, default: () => new Date(), index: true },
  },
  { collection: 'packageHubAuditLog' }
)

export const PackageHubAuditLog = mongoose.model(
  'PackageHubAuditLog',
  PackageHubAuditLogSchema
)

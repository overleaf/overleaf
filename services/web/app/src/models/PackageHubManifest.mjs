import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

export const PackageHubManifestSchema = new Schema(
  {
    name: { type: String, required: true, unique: true, index: true },
    url: { type: String, default: '' },
    version: { type: String, default: '1.0.0' },
    description: { type: String, default: '' },
    author: { type: String, default: 'community' },
    packages: { type: [String], default: [] },
    custom_files: { type: [String], default: [] },
    last_synced_at: { type: Date, default: () => new Date() },
  },
  { collection: 'packageHubManifests' }
)

export const PackageHubManifest = mongoose.model(
  'PackageHubManifest',
  PackageHubManifestSchema
)

import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

export const PackageHubPackageSchema = new Schema(
  {
    name: { type: String, required: true, index: true },
    source: {
      type: String,
      enum: ['texlive', 'ctan', 'custom', 'community'],
      required: true,
    },
    version: { type: String, default: '' },
    description: { type: String, default: '' },
    license: { type: String, default: '' },
    author: { type: String, default: '' },
    size_kb: { type: Number, default: 0 },
    installed: { type: Boolean, default: false, index: true },
    installed_version: { type: String, default: null },
    update_available: { type: Boolean, default: false },
    uploaded_by: { type: String, default: null },
    created_at: { type: Date, default: () => new Date() },
    updated_at: { type: Date, default: () => new Date() },
  },
  { collection: 'packageHubPackages' }
)

PackageHubPackageSchema.index({ name: 1, source: 1 }, { unique: true })

export const PackageHubPackage = mongoose.model(
  'PackageHubPackage',
  PackageHubPackageSchema
)

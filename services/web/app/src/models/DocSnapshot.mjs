import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose

const DocSnapshotSchema = new Schema(
  {
    project_id: Schema.Types.ObjectId,
    doc_id: Schema.Types.ObjectId,
    version: Number,
    lines: [String],
    pathname: String,
    ranges: Schema.Types.Mixed,
    ts: Date,
  },
  { collection: 'docSnapshots', minimize: false }
)

export const DocSnapshot = mongoose.model('DocSnapshot', DocSnapshotSchema)

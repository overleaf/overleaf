const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose

const DeletedFileSchema = new Schema(
  {
    name: String,
    projectId: Schema.ObjectId,
    created: {
      type: Date,
    },
    linkedFileData: { type: Schema.Types.Mixed },
    hash: {
      type: String,
    },
    deletedAt: { type: Date },
  },
  { collection: 'deletedFiles', minimize: false }
)

exports.DeletedFile = mongoose.model('DeletedFile', DeletedFileSchema)
exports.DeletedFileSchema = DeletedFileSchema

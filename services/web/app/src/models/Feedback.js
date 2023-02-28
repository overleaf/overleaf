const mongoose = require('../infrastructure/Mongoose')
const { Schema } = mongoose
const { ObjectId } = Schema

const FeedbackSchema = new Schema(
  {
    userId: {
      type: ObjectId,
      ref: 'User',
    },
    source: String,
    createdAt: {
      type: Date,
      default() {
        return new Date()
      },
    },
    data: {},
  },
  { minimize: false }
)

exports.Feedback = mongoose.model('Feedback', FeedbackSchema)
exports.FeedbackSchema = FeedbackSchema

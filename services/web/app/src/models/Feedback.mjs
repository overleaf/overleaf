import mongoose from '../infrastructure/Mongoose.mjs'
const { Schema } = mongoose
const { ObjectId } = Schema

export const FeedbackSchema = new Schema(
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

export const Feedback = mongoose.model('Feedback', FeedbackSchema)

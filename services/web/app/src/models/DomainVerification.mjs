import mongoose from '../infrastructure/Mongoose.mjs'
const { Schema } = mongoose

export const DomainVerificationSchema = new Schema(
  {
    domain: {
      type: String,
      required: true,
      unique: true,
    },
    token: { type: String, required: true },
    status: {
      type: String,
      enum: ['pending', 'verified', 'failed'],
      default: 'pending',
    },
    createdAt: { type: Date, default: Date.now },
    verifiedAt: Date,
    reverifiedAt: Date,
    verificationAttemptCount: { type: Number, default: 0 },
    groupId: Schema.Types.ObjectId,
    lastVerificationAttemptAt: Date,
    lastFailureReason: {
      type: String,
      enum: ['no_record', 'wrong_token', 'dns_error'],
      default: null,
    },
  },
  {
    collection: 'domainVerifications',
    minimize: false,
  }
)

export const DomainVerification = mongoose.model(
  'DomainVerification',
  DomainVerificationSchema
)

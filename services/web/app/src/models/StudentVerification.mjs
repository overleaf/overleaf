import mongoose from '../infrastructure/Mongoose.mjs'

const { Schema } = mongoose
const { ObjectId } = Schema

/**
 * @typedef {'pending' | 'success' | 'failed'} StudentVerificationStatus
 */

// Kept separate so retention, validity and the retry block can change
// independently, though all three are 30 days at the moment.

// How long a success counts as verified. TODO: 30 days is a placeholder;
// SheerID's own model is annual.
export const VALIDITY_IN_SECONDS = 60 * 60 * 24 * 30

// How long a failure blocks starting again. TODO: decide whether to allow one
// automatic retry first.
export const BLOCK_DURATION_IN_SECONDS = 60 * 60 * 24 * 30

// How long the record is kept, via a Mongo TTL index.
export const EXPIRY_IN_SECONDS = 60 * 60 * 24 * 30

// Runs at boot, since every path that touches a StudentVerification loads this
// module. Fails loudly rather than letting a misconfiguration quietly delete
// records that are still in use.
if (
  EXPIRY_IN_SECONDS < Math.max(VALIDITY_IN_SECONDS, BLOCK_DURATION_IN_SECONDS)
) {
  throw new Error(
    'StudentVerification: EXPIRY_IN_SECONDS must be >= VALIDITY_IN_SECONDS and BLOCK_DURATION_IN_SECONDS (a record must not be deleted by the TTL while it is still authoritative for the purchase gate or the retry block)'
  )
}

/**
 * @param {number} seconds
 */
function dateSecondsFromNow(seconds) {
  const timestamp = new Date()
  timestamp.setSeconds(timestamp.getSeconds() + seconds)
  return timestamp
}

export const StudentVerificationSchema = new Schema(
  {
    // Unique, so it can be the sole lookup key everywhere.
    verificationId: { type: String, required: true, unique: true },
    userId: { type: ObjectId, required: true },
    status: {
      type: String,
      enum: ['pending', 'success', 'failed'],
      default: 'pending',
    },
    // Only ever set alongside a FAILED status. Distinguishes a permanent
    // SheerID block (verificationLimitExceeded) from an ordinary declined
    // result (docReviewLimitExceeded), so the frontend can show 'blocked'
    // rather than 'declined'. Not a status of its own.
    blocked: { type: Boolean, default: false },
    // Upper-case.
    country: { type: String, required: true },
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
    // Throttles the upstream fetch independently of how often the page polls
    // us. Absent means never refreshed.
    lastRefreshedAt: { type: Date },
    // When the status stopped being pending. Set once, alongside the move to
    // success or failed. Subtracting createdAt gives how long the verification
    // took, which updatedAt would not, since any later write moves it.
    resolvedAt: { type: Date },
    // Captured at the start so it survives the user leaving and coming back
    // later via email link, then reattached to the purchase once they are
    // verified.
    itm: {
      itm_campaign: { type: String, default: null },
      itm_content: { type: String, default: null },
      itm_referrer: { type: String, default: null },
    },
    // How long a SUCCESS counts as verified for the purchase gate. See
    // VALIDITY_IN_SECONDS above. The default is only a starting point:
    // StudentVerificationManager sets this from the moment SheerID resolved
    // the verification, so the window does not start ticking while a document
    // review is still going on.
    validUntil: {
      type: Date,
      default: () => dateSecondsFromNow(VALIDITY_IN_SECONDS),
    },
    // How long a FAILED record blocks starting a new verification. See
    // BLOCK_DURATION_IN_SECONDS above. Checked explicitly by the caller
    // (StudentVerificationController.startVerification) rather than
    // relying on the record ageing out via the TTL, so the block duration
    // can move independently of retention. Set from resolvedAt when the
    // verification fails, so the block runs from the failure rather than from
    // when the user started.
    blockedUntil: {
      type: Date,
      default: () => dateSecondsFromNow(BLOCK_DURATION_IN_SECONDS),
    },
    // How long the record is kept. Mongo deletes it when this passes. Set from
    // resolvedAt alongside the other two windows, so a record is never deleted
    // while it is still authoritative for the gate or the retry block.
    expires: {
      type: Date,
      default: () => dateSecondsFromNow(EXPIRY_IN_SECONDS),
      index: { expireAfterSeconds: 0 },
    },
  },
  {
    collection: 'studentVerifications',
    minimize: false,
  }
)

// Not created automatically: infrastructure/Mongoose.mjs sets autoIndex: false
// outside dev. Real environments get them from
// tools/migrations/20260808093000_create_studentVerifications_indexes.mjs,
// which says what each one serves. Keep the two in sync.
StudentVerificationSchema.index({ userId: 1, status: 1, createdAt: -1 })
StudentVerificationSchema.index({ status: 1, lastRefreshedAt: 1 })

export const StudentVerification = mongoose.model(
  'StudentVerification',
  StudentVerificationSchema
)

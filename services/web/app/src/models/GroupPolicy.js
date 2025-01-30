const mongoose = require('../infrastructure/Mongoose')

const { Schema } = mongoose

const GroupPolicySchema = new Schema(
  {
    // User can't delete their own account
    userCannotDeleteOwnAccount: Boolean,

    // User can't add a secondary email address, or affiliation
    userCannotHaveSecondaryEmail: Boolean,

    // User can't have an active  (currently auto-renewing) personal subscription, nor can they start one
    userCannotHaveSubscription: Boolean,

    // User can't choose to leave the group subscription they are managed by
    userCannotLeaveManagingGroupSubscription: Boolean,

    // User can't have a Google SSO account, nor can they link it to their account
    userCannotHaveGoogleSSO: Boolean,

    // User can't have other third-party SSO (e.g. ORCID/IEEE) active on their account, nor can they link it to their account
    userCannotHaveOtherThirdPartySSO: Boolean,

    // User can't use any of our AI features, such as the compile-assistant
    userCannotUseAIFeatures: Boolean,

    // User can't use the chat feature
    userCannotUseChat: Boolean,
  },
  { minimize: false }
)

exports.GroupPolicy = mongoose.model('GroupPolicy', GroupPolicySchema)
exports.GroupPolicySchema = GroupPolicySchema

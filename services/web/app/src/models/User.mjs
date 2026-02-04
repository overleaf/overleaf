import Settings from '@overleaf/settings'
import mongoose from '../infrastructure/Mongoose.mjs'
import TokenGenerator from '../Features/TokenGenerator/TokenGenerator.mjs'
const { Schema } = mongoose
const { ObjectId } = Schema

// See https://stackoverflow.com/questions/386294/what-is-the-maximum-length-of-a-valid-email-address/574698#574698
const MAX_EMAIL_LENGTH = 254
const MAX_NAME_LENGTH = 255

export const UserSchema = new Schema(
  {
    email: { type: String, default: '', maxlength: MAX_EMAIL_LENGTH },
    emails: [
      {
        email: { type: String, default: '', maxlength: MAX_EMAIL_LENGTH },
        reversedHostname: { type: String, default: '' },
        createdAt: {
          type: Date,
          default() {
            return new Date()
          },
        },
        confirmedAt: { type: Date },
        samlProviderId: { type: String },
        affiliationUnchecked: { type: Boolean },
        reconfirmedAt: { type: Date },
      },
    ],
    first_name: {
      type: String,
      default: '',
      maxlength: MAX_NAME_LENGTH,
    },
    last_name: {
      type: String,
      default: '',
      maxlength: MAX_NAME_LENGTH,
    },
    role: { type: String, default: '' },
    institution: { type: String, default: '' },
    hashedPassword: String,
    enrollment: {
      sso: [
        {
          groupId: {
            type: ObjectId,
            ref: 'Subscription',
          },
          linkedAt: Date,
          primary: { type: Boolean, default: false },
        },
      ],
      managedBy: {
        type: ObjectId,
        ref: 'Subscription',
      },
      enrolledAt: { type: Date },
    },
    isAdmin: { type: Boolean, default: false },
    adminRoles: { type: Array },
    signUpDate: {
      type: Date,
      default() {
        return new Date()
      },
    },
    loginEpoch: { type: Number },
    lastActive: { type: Date },
    lastFailedLogin: { type: Date },
    lastLoggedIn: { type: Date },
    lastLoginIp: { type: String, default: '' },
    lastPrimaryEmailCheck: { type: Date },
    lastTrial: { type: Date },
    loginCount: { type: Number, default: 0 },
    holdingAccount: { type: Boolean, default: false },
    ace: {
      mode: { type: String, default: 'none' },
      theme: { type: String, default: 'textmate' },
      overallTheme: { type: String, default: '' },
      // When overallTheme is `system`, we switch between `lightTheme` and `darkTheme` based on system settings
      // When overallTheme is `light-` or empty, we use the `theme` option.
      lightTheme: { type: String, default: 'textmate' },
      darkTheme: { type: String, default: 'overleaf_dark' },
      fontSize: { type: Number, default: '12' },
      autoComplete: { type: Boolean, default: true },
      autoPairDelimiters: { type: Boolean, default: true },
      spellCheckLanguage: { type: String, default: 'en' },
      pdfViewer: { type: String, default: 'pdfjs' },
      syntaxValidation: { type: Boolean },
      fontFamily: { type: String },
      lineHeight: { type: String },
      mathPreview: { type: Boolean, default: true },
      breadcrumbs: { type: Boolean, default: true },
      referencesSearchMode: { type: String, default: 'advanced' }, // 'advanced' or 'simple'
      // enableNewEditor is being phased out in favor of enableNewEditorStageFour
      // when moving the new editor to opt out (stage 4). However, we need to keep the
      // old field for determining whether to show promotional material to users.
      enableNewEditor: { type: Boolean },
      enableNewEditorStageFour: { type: Boolean },
      darkModePdf: { type: Boolean, default: false },
    },
    features: {
      collaborators: {
        type: Number,
        default: Settings.defaultFeatures.collaborators,
      },
      versioning: {
        type: Boolean,
        default: Settings.defaultFeatures.versioning,
      },
      dropbox: { type: Boolean, default: Settings.defaultFeatures.dropbox },
      github: { type: Boolean, default: Settings.defaultFeatures.github },
      gitBridge: { type: Boolean, default: Settings.defaultFeatures.gitBridge },
      compileTimeout: {
        type: Number,
        default: Settings.defaultFeatures.compileTimeout,
      },
      compileGroup: {
        type: String,
        default: Settings.defaultFeatures.compileGroup,
      },
      references: {
        type: Boolean,
        default: Settings.defaultFeatures.references,
      },
      trackChanges: {
        type: Boolean,
        default: Settings.defaultFeatures.trackChanges,
      },
      mendeley: { type: Boolean, default: Settings.defaultFeatures.mendeley },
      zotero: { type: Boolean, default: Settings.defaultFeatures.zotero },
      papers: { type: Boolean, default: Settings.defaultFeatures.papers },
      referencesSearch: {
        type: Boolean,
        default: Settings.defaultFeatures.referencesSearch,
      },
      symbolPalette: {
        type: Boolean,
        default: Settings.defaultFeatures.symbolPalette,
      },
      aiErrorAssistant: {
        type: Boolean,
        default: false,
      },
    },
    featuresOverrides: [
      {
        createdAt: {
          type: Date,
          default() {
            return new Date()
          },
        },
        expiresAt: { type: Date },
        note: { type: String },
        features: {
          aiErrorAssistant: { type: Boolean },
          collaborators: { type: Number },
          versioning: { type: Boolean },
          dropbox: { type: Boolean },
          github: { type: Boolean },
          gitBridge: { type: Boolean },
          compileTimeout: { type: Number },
          compileGroup: { type: String },
          templates: { type: Boolean },
          trackChanges: { type: Boolean },
          mendeley: { type: Boolean },
          papers: { type: Boolean },
          zotero: { type: Boolean },
          referencesSearch: { type: Boolean },
          symbolPalette: { type: Boolean },
        },
      },
    ],
    featuresUpdatedAt: { type: Date },
    featuresEpoch: {
      type: String,
    },
    must_reconfirm: { type: Boolean, default: false },
    referal_id: {
      type: String,
      default() {
        return TokenGenerator.generateReferralId()
      },
    },
    refered_users: [{ type: ObjectId, ref: 'User' }],
    refered_user_count: { type: Number, default: 0 },
    refProviders: {
      // The actual values are managed by third-party-references.
      mendeley: Schema.Types.Mixed,
      zotero: Schema.Types.Mixed,
      papers: Schema.Types.Mixed,
    },
    writefull: {
      enabled: { type: Boolean, default: null },
      autoCreatedAccount: { type: Boolean, default: false },
      isPremium: { type: Boolean, default: false },
      premiumSource: { type: String, default: null },
    },
    aiErrorAssistant: {
      enabled: { type: Boolean, default: true },
    },
    alphaProgram: { type: Boolean, default: false }, // experimental features
    betaProgram: { type: Boolean, default: false },
    labsProgram: { type: Boolean, default: false },
    labsExperiments: { type: Array, default: [] },
    overleaf: {
      id: { type: Number },
      accessToken: { type: String },
      refreshToken: { type: String },
    },
    awareOfV2: { type: Boolean, default: false },
    samlIdentifiers: { type: Array, default: [] },
    thirdPartyIdentifiers: { type: Array, default: [] },
    migratedAt: { type: Date },
    twoFactorAuthentication: {
      createdAt: { type: Date },
      enrolledAt: { type: Date },
      secretEncrypted: { type: String },
    },
    onboardingEmailSentAt: { type: Date },
    splitTests: Schema.Types.Mixed,
    analyticsId: { type: String },
    completedTutorials: Schema.Types.Mixed,
    suspended: { type: Boolean },
    dsMobileApp: {
      subscribed: { type: Boolean },
    },
  },
  { minimize: false }
)

function formatSplitTestsSchema(next) {
  if (this.splitTests) {
    for (const splitTestKey of Object.keys(this.splitTests)) {
      // Old splitTests can be a plain string - skip anything that isn't an array
      if (!Array.isArray(this.splitTests[splitTestKey])) {
        continue
      }
      for (const variantIndex in this.splitTests[splitTestKey]) {
        this.splitTests[splitTestKey][variantIndex].assignedAt = new Date(
          this.splitTests[splitTestKey][variantIndex].assignedAt
        )
      }
    }
  }
  next()
}
UserSchema.pre('save', formatSplitTestsSchema)

export const User = mongoose.model('User', UserSchema)

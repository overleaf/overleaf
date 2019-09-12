/* eslint-disable
    max-len,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
const { Project } = require('./Project')
const Settings = require('settings-sharelatex')
const _ = require('underscore')
const mongoose = require('mongoose')
const uuid = require('uuid')
const { Schema } = mongoose
const { ObjectId } = Schema

// See https://stackoverflow.com/questions/386294/what-is-the-maximum-length-of-a-valid-email-address/574698#574698
const MAX_EMAIL_LENGTH = 254

const UserSchema = new Schema({
  email: { type: String, default: '', maxlength: MAX_EMAIL_LENGTH },
  emails: [
    {
      email: { type: String, default: '', maxlength: MAX_EMAIL_LENGTH },
      reversedHostname: { type: String, default: '' },
      createdAt: {
        type: Date,
        default() {
          return new Date()
        }
      },
      confirmedAt: { type: Date }
    }
  ],
  first_name: { type: String, default: '' },
  last_name: { type: String, default: '' },
  role: { type: String, default: '' },
  institution: { type: String, default: '' },
  hashedPassword: String,
  isAdmin: { type: Boolean, default: false },
  staffAccess: {
    publisherMetrics: { type: Boolean, default: false },
    publisherManagement: { type: Boolean, default: false },
    institutionMetrics: { type: Boolean, default: false },
    institutionManagement: { type: Boolean, default: false },
    groupMetrics: { type: Boolean, default: false },
    groupManagement: { type: Boolean, default: false },
    adminMetrics: { type: Boolean, default: false }
  },
  signUpDate: {
    type: Date,
    default() {
      return new Date()
    }
  },
  lastLoggedIn: { type: Date },
  lastLoginIp: { type: String, default: '' },
  loginCount: { type: Number, default: 0 },
  holdingAccount: { type: Boolean, default: false },
  ace: {
    mode: { type: String, default: 'none' },
    theme: { type: String, default: 'textmate' },
    overallTheme: { type: String, default: '' },
    fontSize: { type: Number, default: '12' },
    autoComplete: { type: Boolean, default: true },
    autoPairDelimiters: { type: Boolean, default: true },
    spellCheckLanguage: { type: String, default: 'en' },
    pdfViewer: { type: String, default: 'pdfjs' },
    syntaxValidation: { type: Boolean },
    fontFamily: { type: String },
    lineHeight: { type: String }
  },
  features: {
    collaborators: {
      type: Number,
      default: Settings.defaultFeatures.collaborators
    },
    versioning: { type: Boolean, default: Settings.defaultFeatures.versioning },
    dropbox: { type: Boolean, default: Settings.defaultFeatures.dropbox },
    github: { type: Boolean, default: Settings.defaultFeatures.github },
    gitBridge: { type: Boolean, default: Settings.defaultFeatures.gitBridge },
    compileTimeout: {
      type: Number,
      default: Settings.defaultFeatures.compileTimeout
    },
    compileGroup: {
      type: String,
      default: Settings.defaultFeatures.compileGroup
    },
    templates: { type: Boolean, default: Settings.defaultFeatures.templates },
    references: { type: Boolean, default: Settings.defaultFeatures.references },
    trackChanges: {
      type: Boolean,
      default: Settings.defaultFeatures.trackChanges
    },
    mendeley: { type: Boolean, default: Settings.defaultFeatures.mendeley },
    zotero: { type: Boolean, default: Settings.defaultFeatures.zotero },
    referencesSearch: {
      type: Boolean,
      default: Settings.defaultFeatures.referencesSearch
    }
  },
  // when auto-merged from SL and must-reconfirm is set, we may end up using
  // `sharelatexHashedPassword` to recover accounts...
  sharelatexHashedPassword: String,
  must_reconfirm: { type: Boolean, default: false },
  referal_id: {
    type: String,
    default() {
      return uuid.v4().split('-')[0]
    }
  },
  refered_users: [{ type: ObjectId, ref: 'User' }],
  refered_user_count: { type: Number, default: 0 },
  refProviders: {
    mendeley: Boolean, // coerce the refProviders values to Booleans
    zotero: Boolean
  },
  betaProgram: { type: Boolean, default: false },
  overleaf: {
    id: { type: Number },
    accessToken: { type: String },
    refreshToken: { type: String }
  },
  awareOfV2: { type: Boolean, default: false },
  samlIdentifiers: { type: Array, default: [] },
  thirdPartyIdentifiers: { type: Array, default: [] },
  migratedAt: { type: Date }
})

const conn = mongoose.createConnection(Settings.mongo.url, {
  server: { poolSize: Settings.mongo.poolSize || 10 },
  config: { autoIndex: false }
})

const User = conn.model('User', UserSchema)

const model = mongoose.model('User', UserSchema)
exports.User = User
exports.UserSchema = UserSchema

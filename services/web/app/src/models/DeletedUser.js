const mongoose = require('mongoose')
const Settings = require('settings-sharelatex')
const { UserSchema } = require('./User')

const { Schema } = mongoose
const { ObjectId } = Schema

const DeleterDataSchema = new Schema({
  deleterId: { type: ObjectId, ref: 'User' },
  deleterIpAddress: { type: String },
  deletedAt: { type: Date },
  deletedUserId: { type: ObjectId },
  deletedUserLastLoggedIn: { type: Date },
  deletedUserSignUpDate: { type: Date },
  deletedUserLoginCount: { type: Number },
  deletedUserReferralId: { type: String },
  deletedUserReferredUsers: [{ type: ObjectId, ref: 'User' }],
  deletedUserReferredUserCount: { type: Number },
  deletedUserOverleafId: { type: Number }
})

const DeletedUserSchema = new Schema(
  {
    deleterData: DeleterDataSchema,
    user: UserSchema
  },
  { collection: 'deletedUsers' }
)

const conn = mongoose.createConnection(Settings.mongo.url, {
  server: { poolSize: Settings.mongo.poolSize || 10 },
  config: { autoIndex: false }
})

const DeletedUser = conn.model('DeletedUser', DeletedUserSchema)

mongoose.model('DeletedUser', DeletedUserSchema)
exports.DeletedUser = DeletedUser
exports.DeletedUserSchema = DeletedUserSchema

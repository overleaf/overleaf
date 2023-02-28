const mongoose = require('../infrastructure/Mongoose')
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
  deletedUserOverleafId: { type: Number },
})

const DeletedUserSchema = new Schema(
  {
    deleterData: DeleterDataSchema,
    user: UserSchema,
  },
  { collection: 'deletedUsers', minimize: false }
)

exports.DeletedUser = mongoose.model('DeletedUser', DeletedUserSchema)

exports.DeletedUserSchema = DeletedUserSchema

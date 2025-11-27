import mongoose from '../infrastructure/Mongoose.mjs'
import { UserSchema } from './User.mjs'

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

export const DeletedUserSchema = new Schema(
  {
    deleterData: DeleterDataSchema,
    user: UserSchema,
  },
  { collection: 'deletedUsers', minimize: false }
)

export const DeletedUser = mongoose.model('DeletedUser', DeletedUserSchema)

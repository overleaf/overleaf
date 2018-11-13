mongoose = require 'mongoose'
Settings = require 'settings-sharelatex'
TeamInviteSchema = require('./TeamInvite').TeamInviteSchema

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

SubscriptionSchema = new Schema
	admin_id     :   {type:ObjectId, ref:'User', index: {unique: true, dropDups: true}}
	manager_ids  :   [ type:ObjectId, ref:'User' ]
	member_ids   :   [ type:ObjectId, ref:'User' ]
	invited_emails:  [ String ]
	teamInvites  :   [ TeamInviteSchema ]
	recurlySubscription_id : String
	teamName 	 : {type: String}
	teamNotice : {type: String}
	planCode 	 : {type: String}
	groupPlan	 : {type: Boolean, default: false}
	membersLimit: {type:Number, default:0}
	customAccount: Boolean
	freeTrial:
		expiresAt: Date
		downgraded: Boolean
		planCode: String
		allowed: {type: Boolean, default: true}
	overleaf:
		id:
			type: Number
			index:
				unique: true,
				partialFilterExpression: {'overleaf.id': {$exists: true}}


SubscriptionSchema.statics.findAndModify = (query, update, callback)->
	self = @
	this.update query, update, ->
		self.findOne query, callback

conn = mongoose.createConnection(Settings.mongo.url, {
	server: {poolSize: Settings.mongo.poolSize || 10},
	config: {autoIndex: false}
})

Subscription = conn.model('Subscription', SubscriptionSchema)

mongoose.model 'Subscription', SubscriptionSchema
exports.Subscription = Subscription
exports.SubscriptionSchema = SubscriptionSchema

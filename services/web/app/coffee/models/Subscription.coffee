mongoose = require 'mongoose'
Settings = require 'settings-sharelatex'

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

SubscriptionSchema = new Schema
	admin_id     :   {type:ObjectId, ref:'User', index: {unique: true, dropDups: true}}
	member_ids 	 :   [ type:ObjectId, ref:'User' ]
	recurlySubscription_id : String
	planCode 	 : {type: String}
	groupPlan	 : {type: Boolean, default: false}
	membersLimit: {type:Number, default:0}
	freeTrial:
		expiresAt: Date
		downgraded: Boolean
		planCode: String
		allowed: {type: Boolean, default: true}


SubscriptionSchema.statics.findAndModify = (query, update, callback)->
	self = @
	this.update query, update, ->
		self.findOne query, callback


conn = mongoose.createConnection(Settings.mongo.url, server: poolSize: Settings.mongo.poolSize || 10)

Subscription = conn.model('Subscription', SubscriptionSchema)

mongoose.model 'Subscription', SubscriptionSchema
exports.Subscription = Subscription
exports.SubscriptionSchema = SubscriptionSchema
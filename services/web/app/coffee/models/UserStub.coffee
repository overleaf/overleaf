Settings = require "settings-sharelatex"
mongoose = require('mongoose')
Schema = mongoose.Schema
ObjectId = Schema.ObjectId

UserStubSchema = new Schema
	email      : { type : String, default : '' }
	first_name : { type : String, default : '' }
	last_name  : { type : String, default : '' }
	overleaf   : { id: { type: Number } }

conn = mongoose.createConnection(Settings.mongo.url, {
	server: {poolSize: Settings.mongo.poolSize || 10},
	config: {autoIndex: false}
})

UserStub = conn.model('UserStub', UserStubSchema)

model = mongoose.model 'UserStub', UserStubSchema
exports.UserStub = UserStub

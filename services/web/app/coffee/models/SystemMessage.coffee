mongoose = require 'mongoose'
Settings = require 'settings-sharelatex'

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

SystemMessageSchema = new Schema
	content : type: String, default:''
	
conn = mongoose.createConnection(Settings.mongo.url, server: poolSize: Settings.mongo.poolSize || 10)

exports.SystemMessage = conn.model('SystemMessage', SystemMessageSchema)

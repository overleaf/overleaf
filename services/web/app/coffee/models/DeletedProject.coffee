mongoose = require('mongoose')
Settings = require 'settings-sharelatex'
ProjectSchema = require('./Project.js').ProjectSchema

Schema = mongoose.Schema
ObjectId = Schema.ObjectId

DeleterDataSchema = new Schema
	deleterId: {type: ObjectId, ref: 'User'}
	deleterIpAddress: { type: String }
	deletedAt: { type: Date }

DeletedProjectSchema = new Schema({
	deleterData : [DeleterDataSchema]
	project: [ProjectSchema]
}, collection: 'deletedProjects')

conn = mongoose.createConnection(Settings.mongo.url, {
	server: {poolSize: Settings.mongo.poolSize || 10},
	config: {autoIndex: false}
})

DeletedProject = conn.model('DeletedProject', DeletedProjectSchema)

mongoose.model 'DeletedProject', DeletedProjectSchema
exports.DeletedProject = DeletedProject
exports.DeletedProjectSchema = DeletedProjectSchema

mongoose = require 'mongoose'
Schema = mongoose.Schema
ObjectId = Schema.ObjectId
settings = require 'settings-sharelatex'
logger = require 'logger-sharelatex'
request = require 'request'

PublisherSchema = new Schema
	slug: { type: String, required: true }
	managerIds: [ type:ObjectId, ref:'User' ]

# fetch publisher's (brand on v1) data from v1 API. Errors are ignored
PublisherSchema.method 'fetchV1Data', (callback = (error, publisher)->) ->
	request {
		baseUrl: settings.apis.v1.url
		url: "/api/v2/brands/#{this.slug}"
		method: 'GET'
		auth:
			user: settings.apis.v1.user
			pass: settings.apis.v1.pass
			sendImmediately: true
	}, (error, response, body) =>
		try
			parsedBody = JSON.parse(body)
		catch error # log error and carry on without v1 data
			logger.err { model: 'Publisher', slug: this.slug, error }, '[fetchV1DataError]'
		this.name = parsedBody?.name
		this.partner = parsedBody?.partner
		callback(null, this)

conn = mongoose.createConnection(settings.mongo.url, {
	server: {poolSize: settings.mongo.poolSize || 10},
	config: {autoIndex: false}
})

Publisher = conn.model 'Publisher', PublisherSchema
exports.Publisher = Publisher
exports.PublisherSchema = PublisherSchema

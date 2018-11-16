mongoose = require 'mongoose'
Schema = mongoose.Schema
ObjectId = Schema.ObjectId
settings = require 'settings-sharelatex'
request = require 'request'

InstitutionSchema = new Schema
	v1Id: { type: Number, required: true }
	managerIds: [ type:ObjectId, ref:'User' ]

# fetch institution's data from v1 API. Errors are ignored
InstitutionSchema.method 'fetchV1Data', (callback = (error, institution)->) ->
	url = "#{settings.apis.v1.url}/universities/list/#{this.v1Id}"
	request.get url, (error, response, body) =>
		try parsedBody = JSON.parse(body) catch e
		this.name = parsedBody?.name
		this.countryCode = parsedBody?.country_code
		this.departments = parsedBody?.departments
		callback(null, this)

mongoose.model 'Institution', InstitutionSchema
exports.Institution = mongoose.model 'Institution'
exports.InstitutionSchema = InstitutionSchema

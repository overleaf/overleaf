settings = require "settings-sharelatex"
logger = require "logger-sharelatex"
V1Api = require "../V1/V1Api"

module.exports = BrandVariationsHandler =
	getBrandVariationById: (brandVariationId, callback = (error, brandVariationDetails) ->)->
		if !brandVariationId? or brandVariationId == ""
			return callback(new Error("Branding variation id not provided"))
		logger.log brandVariationId: brandVariationId, "fetching brand variation details from v1"
		V1Api.request {
			uri: "/api/v2/brand_variations/#{brandVariationId}"
		}, (error, response, brandVariationDetails) ->
			if error?
				logger.err { brandVariationId, error}, "error getting brand variation details"
				return callback(error)
			callback(null, brandVariationDetails)

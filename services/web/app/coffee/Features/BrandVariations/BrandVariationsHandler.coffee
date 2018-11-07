url = require "url"
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
			_formatBrandVariationDetails brandVariationDetails
			callback(null, brandVariationDetails)

_formatBrandVariationDetails = (details) ->
	if details.export_url?
		details.export_url = _setV1AsHostIfRelativeURL details.export_url
	if details.home_url?
		details.home_url = _setV1AsHostIfRelativeURL details.home_url
	if details.logo_url?
		details.logo_url = _setV1AsHostIfRelativeURL details.logo_url
	if details.journal_guidelines_url?
		details.journal_guidelines_url = _setV1AsHostIfRelativeURL details.journal_guidelines_url
	if details.journal_cover_url?
		details.journal_cover_url = _setV1AsHostIfRelativeURL details.journal_cover_url
	if details.submission_confirmation_page_logo_url?
		details.submission_confirmation_page_logo_url = _setV1AsHostIfRelativeURL details.submission_confirmation_page_logo_url
	if details.publish_menu_icon?
		details.publish_menu_icon = _setV1AsHostIfRelativeURL details.publish_menu_icon

_setV1AsHostIfRelativeURL = (urlString) ->
	# The first argument is the base URL to resolve against if the second argument is not absolute.
	# As it only applies if the second argument is not absolute, we can use it to transform relative URLs into
	# absolute ones using v1 as the host. If the URL is absolute (e.g. a filepicker one), then the base
	# argument is just ignored
	url.resolve settings?.apis?.v1?.url, urlString
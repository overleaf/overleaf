expect = require("chai").expect
SandboxedModule = require("sandboxed-module")
assert = require("assert")
path = require("path")
sinon = require("sinon")
expect = require("chai").expect
modulePath = path.join __dirname, "../../../../app/js/Features/BrandVariations/BrandVariationsHandler"

describe "BrandVariationsHandler", ->

	beforeEach ->
		@settings =
			apis:
				v1:
					url: "http://overleaf.example.com"
		@logger = 
			err: ->
			log: ->
		@V1Api = 
			request: sinon.stub()
		@BrandVariationsHandler = SandboxedModule.require modulePath, requires:
			"settings-sharelatex": @settings
			"logger-sharelatex": @logger
			"../V1/V1Api": @V1Api
		@mockedBrandVariationDetails = 
			id: "12"
			active: true
			brand_name: "The journal"
			logo_url: "http://my.cdn.tld/journal-logo.png"
			journal_cover_url: "http://my.cdn.tld/journal-cover.jpg"
			home_url: "http://www.thejournal.com/"
			publish_menu_link_html: "Submit your paper to the <em>The Journal</em>"

	describe "getBrandVariationById", ->
		it "should call the callback with an error when the branding variation id is not provided", (done) ->
			@BrandVariationsHandler.getBrandVariationById null, (err, brandVariationDetails) =>
				expect(err).to.be.instanceof Error
				done()

		it "should call the callback with an error when the request errors", (done) ->
			@V1Api.request.callsArgWith 1, new Error()
			@BrandVariationsHandler.getBrandVariationById "12", (err, brandVariationDetails) =>
				expect(err).to.be.instanceof Error
				done()

		it "should call the callback with branding details when request succeeds", (done) ->
			@V1Api.request.callsArgWith 1, null, { statusCode: 200 }, @mockedBrandVariationDetails
			@BrandVariationsHandler.getBrandVariationById "12", (err, brandVariationDetails) =>
				expect(err).to.not.exist
				expect(brandVariationDetails).to.deep.equal @mockedBrandVariationDetails
				done()

		it "should transform relative URLs in v1 absolute ones", (done) ->
			@mockedBrandVariationDetails.logo_url = "/journal-logo.png" 
			@V1Api.request.callsArgWith 1, null, { statusCode: 200 }, @mockedBrandVariationDetails
			@BrandVariationsHandler.getBrandVariationById "12", (err, brandVariationDetails) =>
				expect(brandVariationDetails.logo_url.startsWith(@settings.apis.v1.url)).to.be.true
				done()


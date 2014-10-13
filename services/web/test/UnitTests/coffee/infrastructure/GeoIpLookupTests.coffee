should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/infrastructure/GeoIpLookup"
expect = require("chai").expect

describe "GeoIpLookup", ->

	beforeEach ->

		@settings =
			apis:
				geoIpLookup:
					url:"http://lookup.com"
		@request = 
			get: sinon.stub()
		@GeoIpLookup = SandboxedModule.require modulePath, requires:
			"request": @request
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->
		@ipAddress = "123.456.789.123"

		@stubbedResponse = 
			"ip":@ipAddress
			"country_code":"GB"
			"country_name":"United Kingdom"
			"region_code":"H9"
			"region_name":"London, City of"
			"city":"London"
			"zipcode":"SE16"
			"latitude":51.0
			"longitude":-0.0493
			"metro_code":""
			"area_code":""

	describe "getDetails", ->
		beforeEach ->
			@request.get.callsArgWith(1, null, @stubbedResponse)

		it "should request the details using the ip", (done)->
			@GeoIpLookup.getDetails @ipAddress, (err)=>
				@request.get.calledWith(url:@settings.apis.geoIpLookup.url+"/"+@ipAddress).should.equal true
				done()

		it "should return the ip details", (done)->
			@GeoIpLookup.getDetails @ipAddress, (err, returnedDetails)=>
				assert.deepEqual returnedDetails, @stubbedResponse
				done()

		it "should take the first ip in the string", (done)->
			@GeoIpLookup.getDetails " #{@ipAddress} 456.312.452.102 432.433.888.234", (err)=>
				@request.get.calledWith(url:@settings.apis.geoIpLookup.url+"/"+@ipAddress).should.equal true
				done()

	describe "getCurrencyCode", ->

		it "should return GBP for GB country", (done)->
			@GeoIpLookup.getDetails = sinon.stub().callsArgWith(1, null, @stubbedResponse)
			@GeoIpLookup.getCurrencyCode @ipAddress, (err, currencyCode)->
				currencyCode.should.equal "GBP"
				done()

		it "should return GBP for gb country", (done)->
			@stubbedResponse.country_code = "gb"
			@GeoIpLookup.getDetails = sinon.stub().callsArgWith(1, null, @stubbedResponse)
			@GeoIpLookup.getCurrencyCode @ipAddress, (err, currencyCode)->
				currencyCode.should.equal "GBP"
				done()

		it "should return USD for US", (done)->
			@stubbedResponse.country_code = "US"
			@GeoIpLookup.getDetails = sinon.stub().callsArgWith(1, null, @stubbedResponse)
			@GeoIpLookup.getCurrencyCode @ipAddress, (err, currencyCode)->
				currencyCode.should.equal "USD"
				done()

		it "should return EUR for DE", (done)->
			@stubbedResponse.country_code = "DE"
			@GeoIpLookup.getDetails = sinon.stub().callsArgWith(1, null, @stubbedResponse)
			@GeoIpLookup.getCurrencyCode @ipAddress, (err, currencyCode)->
				currencyCode.should.equal "EUR"
				done()

		it "should default to USD if there is an error", (done)->
			@GeoIpLookup.getDetails = sinon.stub().callsArgWith(1, "problem")
			@GeoIpLookup.getCurrencyCode @ipAddress, (err, currencyCode)->
				currencyCode.should.equal "USD"
				done()

		it "should default to USD if there are no details", (done)->
			@GeoIpLookup.getDetails = sinon.stub().callsArgWith(1)
			@GeoIpLookup.getCurrencyCode @ipAddress, (err, currencyCode)->
				currencyCode.should.equal "USD"
				done()

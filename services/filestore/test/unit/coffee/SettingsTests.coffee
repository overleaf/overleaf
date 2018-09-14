assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/BucketController.js"

describe "Settings", ->
	describe "s3", ->
		it "should use JSONified env var if present", (done)->
			s3_settings =
				bucket1:
					auth_key: 'bucket1_key'
					auth_secret: 'bucket1_secret'
			process.env['S3_BUCKET_CREDENTIALS'] = JSON.stringify s3_settings

			settings = require("settings-sharelatex")
			expect(settings.filestore.s3BucketCreds).to.deep.equal s3_settings
			done()

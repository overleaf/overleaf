should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/PasswordReset/PasswordResetController"
expect = require("chai").expect

describe "PasswordResetController", ->

	beforeEach ->

		@settings = {}
		@PasswordResetController = SandboxedModule.require modulePath, requires:
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->


	describe "requestPasswordReset", ->

		it "should check the user exists", (done)->

			done()	

		it "should get a unique token and send the email", (done)->
			done()



	


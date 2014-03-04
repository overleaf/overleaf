should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Email/EmailHandler"
expect = require("chai").expect

describe "EmailHandler", ->

	beforeEach ->

		@settings = {}
		@EmailTemplator = 
			buildEmail:sinon.stub()
		@EmailSender =
			sendEmail:sinon.stub()
		@EmailHandler = SandboxedModule.require modulePath, requires:
			"./EmailTemplator":@EmailTemplator
			"./EmailSender":@EmailSender
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->

		@html = "<html>hello</html>"

	describe "send email", ->

		it "should use the correct options", (done)->
			@EmailTemplator.buildEmail.returns({html:@html})
			@EmailSender.sendEmail.callsArgWith(1)

			opts =
				to: "bob@bob.com"
			@EmailHandler.sendEmail "welcome", opts, =>
				args = @EmailSender.sendEmail.args[0][0]
				args.html.should.equal @html
				done()



		it "should return the erroor", (done)->
			@EmailTemplator.buildEmail.returns({html:@html})
			@EmailSender.sendEmail.callsArgWith(1, "error")

			opts =
				to: "bob@bob.com"
				subject:"hello bob"
			@EmailHandler.sendEmail "welcome", opts, (err)=>
				err.should.equal "error"
				done()

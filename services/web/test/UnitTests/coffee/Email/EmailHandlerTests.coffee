should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Email/EmailHandler"
expect = require("chai").expect

describe "EmailHandler", ->

	beforeEach ->

		@settings = 
			email:{}
		@EmailBuilder = 
			buildEmail:sinon.stub()
		@EmailSender =
			sendEmail:sinon.stub()
		@EmailHandler = SandboxedModule.require modulePath, requires:
			"./EmailBuilder":@EmailBuilder
			"./EmailSender":@EmailSender
			"settings-sharelatex":@settings
			"logger-sharelatex": log:->

		@html = "<html>hello</html>"

	describe "send email", ->

		it "should use the correct options", (done)->
			@EmailBuilder.buildEmail.returns({html:@html})
			@EmailSender.sendEmail.callsArgWith(1)

			opts =
				to: "bob@bob.com"
			@EmailHandler.sendEmail "welcome", opts, =>
				args = @EmailSender.sendEmail.args[0][0]
				args.html.should.equal @html
				done()

		it "should return the erroor", (done)->
			@EmailBuilder.buildEmail.returns({html:@html})
			@EmailSender.sendEmail.callsArgWith(1, "error")

			opts =
				to: "bob@bob.com"
				subject:"hello bob"
			@EmailHandler.sendEmail "welcome", opts, (err)=>
				err.should.equal "error"
				done()

		it "should not send an email if lifecycle is not enabled", (done)->
			@settings.email.lifecycle = false
			@EmailBuilder.buildEmail.returns({type:"lifecycle"})
			@EmailHandler.sendEmail "welcome", {}, =>
				@EmailSender.sendEmail.called.should.equal false
				done()

		it "should send an email if lifecycle is not enabled but the type is notification", (done)->
			@settings.email.lifecycle = false
			@EmailBuilder.buildEmail.returns({type:"notification"})
			@EmailSender.sendEmail.callsArgWith(1)
			opts =
				to: "bob@bob.com"
			@EmailHandler.sendEmail "welcome", opts, =>
				@EmailSender.sendEmail.called.should.equal true
				done()

		it "should send lifecycle email if it is enabled", (done)->
			@settings.email.lifecycle = true
			@EmailBuilder.buildEmail.returns({type:"lifecycle"})
			@EmailSender.sendEmail.callsArgWith(1)
			opts =
				to: "bob@bob.com"
			@EmailHandler.sendEmail "welcome", opts, =>
				@EmailSender.sendEmail.called.should.equal true
				done()

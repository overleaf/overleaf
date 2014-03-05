should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
sinon = require('sinon')
modulePath = path.join __dirname, "../../../../app/js/Features/Email/EmailSender.js"
expect = require("chai").expect

describe "Email", ->

	beforeEach ->

		@settings =
			email:
				ses:
					key: "key"
					secret: "secret"
				fromAddress: "bob@bob.com"
				replyToAddress: "sally@gmail.com"

		@sesClient = 
			sendemail: sinon.stub()
		@ses = 
			createClient: => @sesClient
		@sender = SandboxedModule.require modulePath, requires:
			'node-ses': @ses
			"settings-sharelatex":@settings
			"logger-sharelatex": 
				log:->
				warn:->
				err:->

		@opts =
			to: "bob@bob.com"
			subject: "new email"
			html: "<hello></hello>"
			replyTo: "sarah@bob.com"

	describe "sendEmail", ->

		it "should set the properties on the email to send", (done)->
			@sesClient.sendemail.callsArgWith(1)

			@sender.sendEmail @opts, =>
				args = @sesClient.sendemail.args[0][0]
				args.message.should.equal @opts.html
				args.to.should.equal @opts.to
				args.subject.should.equal @opts.subject
				done()

		it "should return the error", (done)->	
			@sesClient.sendemail.callsArgWith(1, "error")
			@sender.sendEmail {}, (err)=>
				err.should.equal "error"
				done()


		it "should use the from address from settings", (done)->
			@sesClient.sendemail.callsArgWith(1)

			@sender.sendEmail @opts, =>
				args = @sesClient.sendemail.args[0][0]
				args.from.should.equal @settings.email.fromAddress
				done()

		it "should use the reply to address from settings", (done)->
			@sesClient.sendemail.callsArgWith(1)

			@sender.sendEmail @opts, =>
				args = @sesClient.sendemail.args[0][0]
				args.replyTo.should.equal @settings.email.replyToAddress
				done()


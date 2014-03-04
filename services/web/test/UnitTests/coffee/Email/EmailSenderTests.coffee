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
			ses:
				key: "key"
				secret: "secret"
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

	describe "sendEmail", ->

		it "should set the properties on the email to send", (done)->
			@sesClient.sendemail.callsArgWith(1)

			opts =
				to: "bob@bob.com"
				subject: "new email"
				html: "<hello></hello>"
				replyTo: "sarah@bob.com"
			@sender.sendEmail opts, =>
				args = @sesClient.sendemail.args[0][0]
				args.message.should.equal opts.html
				args.to.should.equal opts.to
				args.subject.should.equal opts.subject
				done()

		it "should return the error", (done)->	
			@sesClient.sendemail.callsArgWith(1, "error")
			@sender.sendEmail {}, (err)=>
				err.should.equal "error"
				done()

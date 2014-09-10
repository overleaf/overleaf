SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Dropbox/DropboxWebhookController.js'

describe 'DropboxWebhookController', ->
	beforeEach ->
		@req =
			session:
				destroy: ->

		@DropboxWebhookController = SandboxedModule.require modulePath, requires:
			"./DropboxWebhookHandler": @DropboxWebhookHandler = {}
			'logger-sharelatex':
				log:->
				err:->

	describe "verify", ->
		beforeEach ->
			@res =
				send: sinon.stub()
			@req.query =
				challenge: @challenge = "foo"
			@DropboxWebhookController.verify(@req, @res)
			
		it "should echo the challenge parameter back", ->
			@res.send.calledWith(@challenge).should.equal true
			
	describe "webhook", ->
		beforeEach ->
			@req.body =
				delta:
					users: @dropbox_uids = [
						"123456",
						"789123"
					]
			@res.send = sinon.stub()
			@DropboxWebhookHandler.pollDropboxUids = sinon.stub().callsArg(1)
			@DropboxWebhookController.webhook(@req, @res)
			
		it "should poll the Dropbox uids", ->
			@DropboxWebhookHandler.pollDropboxUids
				.calledWith(@dropbox_uids)
				.should.equal true
				
		it "should return success", ->
			@res.send
				.calledWith(200)
				.should.equal true


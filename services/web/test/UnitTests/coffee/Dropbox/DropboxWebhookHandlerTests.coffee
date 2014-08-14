SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
expect = require("chai").expect
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Dropbox/DropboxWebhookHandler.js'

describe 'DropboxWebhookHandler', ->
	beforeEach ->
		@DropboxWebhookHandler = SandboxedModule.require modulePath, requires:
			"../../models/User": User: @User = {}
			"../ThirdPartyDataStore/TpdsUpdateSender": @TpdsUpdateSender = {}
			"redis":
				createClient: () => @rclient =
					auth: sinon.stub()
			'settings-sharelatex': redis: web: {}
			'logger-sharelatex':
				log:->
				err:->
		@callback = sinon.stub()

	describe "pollDropboxUids", ->
		beforeEach (done) ->
			@dropbox_uids = [
				"123456",
				"789123"
			]
			@DropboxWebhookHandler.pollDropboxUid = sinon.stub().callsArg(1)
			@DropboxWebhookHandler.pollDropboxUids @dropbox_uids, done
			
		it "should call pollDropboxUid for each uid", ->
			for uid in @dropbox_uids
				@DropboxWebhookHandler.pollDropboxUid
					.calledWith(uid)
					.should.equal true
					
	describe "pollDropboxUid", ->
		beforeEach ->
			@dropbox_uid = "dropbox-123456"
			@user_id = "sharelatex-user-id"
			@User.find = sinon.stub().callsArgWith(1, null, [ _id: @user_id ])
			@TpdsUpdateSender.pollDropboxForUser = sinon.stub().callsArg(1)
			
		describe "when there is already a poll in progress", () ->
			beforeEach ->
				@DropboxWebhookHandler._delayAndBatchPoll = sinon.stub().callsArgWith(1, null, false)
				@DropboxWebhookHandler.pollDropboxUid @dropbox_uid, @callback
				
			it "should not go ahead with the poll", ->
				@TpdsUpdateSender.pollDropboxForUser.called.should.equal false
				
		describe "when we are the one to do the delayed poll", () ->
			beforeEach ->
				@DropboxWebhookHandler._delayAndBatchPoll = sinon.stub().callsArgWith(1, null, true)
				@DropboxWebhookHandler.pollDropboxUid @dropbox_uid, @callback
				
			it "should look up the user", ->
				@User.find
					.calledWith({ "dropbox.access_token.uid": @dropbox_uid, "features.dropbox": true })
					.should.equal true
					
			it "should poll the user's Dropbox", ->
				@TpdsUpdateSender.pollDropboxForUser
					.calledWith(@user_id)
					.should.equal true
					
			it "should call the callback", ->
				@callback.called.should.equal true
				
	describe "_delayAndBatchPoll", () ->
		beforeEach ->
			@dropbox_uid = "dropbox-uid-123"
			@DropboxWebhookHandler.POLL_DELAY_IN_MS = 100
			
		describe "when no one else is polling yet", ->
			beforeEach (done) ->
				@rclient.set = sinon.stub().callsArgWith(5, null, "OK")
				@start = Date.now()
				@DropboxWebhookHandler._delayAndBatchPoll @dropbox_uid, (error, @shouldPoll) =>
					@end = Date.now()
					done()
					
			it "should set the lock", ->
				@rclient.set
					.calledWith("dropbox-poll-lock:#{@dropbox_uid}", "LOCK", "PX", @DropboxWebhookHandler.POLL_DELAY_IN_MS, "NX")
					.should.equal true
			
			it "should return the callback after the delay with shouldPoll=true", ->
				@shouldPoll.should.equal true
				expect(@end - @start).to.be.at.least(@DropboxWebhookHandler.POLL_DELAY_IN_MS)
			
		describe "when someone else is already polling", ->
			beforeEach ->
				@rclient.set = sinon.stub().callsArgWith(5, null, null)
				@DropboxWebhookHandler._delayAndBatchPoll @dropbox_uid, @callback
			
			it "should return the callback immediately with shouldPoll=false", ->
				@callback.calledWith(null, false).should.equal true
				

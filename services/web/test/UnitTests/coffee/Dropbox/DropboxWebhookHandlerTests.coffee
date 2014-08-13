SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Dropbox/DropboxWebhookHandler.js'

describe 'DropboxWebhookHandler', ->
	beforeEach ->
		@DropboxWebhookHandler = SandboxedModule.require modulePath, requires:
			"../../models/User": User: @User = {}
			"../ThirdPartyDataStore/TpdsUpdateSender": @TpdsUpdateSender = {}
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

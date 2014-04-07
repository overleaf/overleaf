SandboxedModule = require('sandboxed-module')
assert = require('assert')
require('chai').should()
sinon = require('sinon')
modulePath = require('path').join __dirname, '../../../../app/js/Features/Dropbox/DropboxUserController.js'


describe 'DropboxUserController', ->

	beforeEach ->
		@DropboxHandler =
			getDropboxRegisterUrl: sinon.stub()
			completeRegistration: sinon.stub()
			unlinkAccount: sinon.stub()

		@controller = SandboxedModule.require modulePath, requires:
			'./DropboxHandler': @DropboxHandler
			'logger-sharelatex':
				log:->
				err:->

		@user_id = "23j21lk3j1312j321jkljkl"
		@req = 
			session:
				user:
					_id: @user_id
		@res = {}

	describe "redirectUserToDropboxAuth", ->
		beforeEach ->
			@dropboxUrl = "www.dropbox.com"
			@DropboxHandler.getDropboxRegisterUrl.callsArgWith(1, null, @dropboxUrl)

		it "should call getDropboxRegisterUrl with the user id", (done)->

			@res.redirect = (redirectUrl)=>
				redirectUrl.should.equal @dropboxUrl
				@DropboxHandler.getDropboxRegisterUrl.calledWith(@user_id).should.equal true
				done()

			@controller.redirectUserToDropboxAuth @req, @res

	describe "completeDropboxRegistration", ->
		beforeEach ->
			@DropboxHandler.completeRegistration.callsArgWith(1)

		it "should call getDropboxRegisterUrl with the user id", (done)->

			@res.redirect = (redirectUrl)=>
				redirectUrl.should.equal "/user/settings#dropboxSettings"
				@DropboxHandler.completeRegistration.calledWith(@user_id).should.equal true
				done()

			@controller.completeDropboxRegistration @req, @res


	describe "unlinkDropbox", ->

		beforeEach ->
			@DropboxHandler.unlinkAccount.callsArgWith(1)

		it "should call getDropboxRegisterUrl with the user id", (done)->

			@res.redirect = (redirectUrl)=>
				redirectUrl.should.equal "/user/settings#dropboxSettings"
				@DropboxHandler.unlinkAccount.calledWith(@user_id).should.equal true
				done()

			@controller.unlinkDropbox @req, @res


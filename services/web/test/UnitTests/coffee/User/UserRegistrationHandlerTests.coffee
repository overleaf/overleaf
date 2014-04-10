should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../app/js/Features/User/UserRegistrationHandler'
sinon = require("sinon")
expect = require("chai").expect

describe "UserRegistrationHandler", ->

	beforeEach ->
		@user =
			_id: "31j2lk21kjl"
		@User = 
			findOne:sinon.stub()
			update: sinon.stub().callsArgWith(2)
		@UserCreator = 
			createNewUser:sinon.stub().callsArgWith(1, null, @user)
		@AuthenticationManager =
			setUserPassword: sinon.stub().callsArgWith(2)
		@NewsLetterManager =
			subscribe: sinon.stub().callsArgWith(1)
		@EmailHandler =
			sendEmail:sinon.stub().callsArgWith(2)
		@handler = SandboxedModule.require modulePath, requires:
			"../../models/User": {User:@User}
			"./UserCreator": @UserCreator
			"../Authentication/AuthenticationManager":@AuthenticationManager
			"../Newsletter/NewsletterManager":@NewsLetterManager
			"../Email/EmailHandler": @EmailHandler

		@passingRequest = {email:"something@email.com", password:"123"}


	describe 'validate Register Request', ->


		it 'allow working account through', ->
			result = @handler._registrationRequestIsValid @passingRequest
			result.should.equal true
		
		it 'not allow not valid email through ', ()->
			@passingRequest.email = "notemail"
			result = @handler._registrationRequestIsValid @passingRequest
			result.should.equal false

		it 'not allow no email through ', ->
			@passingRequest.email = ""
			result = @handler._registrationRequestIsValid @passingRequest
			result.should.equal false
		
		it 'not allow no password through ', ()->
			@passingRequest.password= ""
			result = @handler._registrationRequestIsValid @passingRequest
			result.should.equal false



	describe "registerNewUser", ->

		describe "holdingAccount", (done)->

			beforeEach ->
				@user.holdingAccount = true
				@handler._registrationRequestIsValid = sinon.stub().returns true
				@User.findOne.callsArgWith(1, null, @user)

			it "should not create a new user if there is a holding account there", (done)->
				@handler.registerNewUser @passingRequest, (err)=>
					@UserCreator.createNewUser.called.should.equal false
					done()

			it "should set holding account to false", (done)->
				@handler.registerNewUser @passingRequest, (err)=>
					update = @User.update.args[0]
					assert.deepEqual update[0], {_id:@user._id}
					assert.deepEqual update[1], {"$set":{holdingAccount:false}}
					done()

		describe "invalidRequest", ->

			it "should not create a new user if the the request is not valid", (done)->
				@handler._registrationRequestIsValid = sinon.stub().returns false
				@handler.registerNewUser @passingRequest, (err)=>
					expect(err).to.exist
					@UserCreator.createNewUser.called.should.equal false
					done()

			it "should return email registered in the error if there is a non holdingAccount there", (done)->
				@User.findOne.callsArgWith(1, null, {holdingAccount:false})
				@handler.registerNewUser @passingRequest, (err)=>
					err.should.equal "EmailAlreadyRegisterd"
					done()

		describe "validRequest", ->
			beforeEach ->
				@handler._registrationRequestIsValid = sinon.stub().returns true
				@User.findOne.callsArgWith 1

			it "should create a new user", (done)->
				@handler.registerNewUser @passingRequest, (err)=>
					@UserCreator.createNewUser.calledWith({email:@passingRequest.email, holdingAccount:false}).should.equal true
					done()

			it 'lower case email', (done)->
				@passingRequest.email = "soMe@eMail.cOm"
				@handler.registerNewUser @passingRequest, (err)=>
					@UserCreator.createNewUser.calledWith({email:@passingRequest.email.toLowerCase(), holdingAccount:false}).should.equal true
					done()

			it 'trim white space from email', (done)->
				@passingRequest.email = " some@email.com "
				@handler.registerNewUser @passingRequest, (err)=>
					@UserCreator.createNewUser.calledWith({email:"some@email.com", holdingAccount:false}).should.equal true
					done()


			it "should set the password", (done)->
				@handler.registerNewUser @passingRequest, (err)=>
					@AuthenticationManager.setUserPassword.calledWith(@user._id, @passingRequest.password).should.equal true
					done()			

			it "should add the user to the news letter manager", (done)->
				@handler.registerNewUser @passingRequest, (err)=>
					@NewsLetterManager.subscribe.calledWith(@user).should.equal true
					done()

			it "should send a welcome email", (done)->
				@handler.registerNewUser @passingRequest, (err)=>
					@EmailHandler.sendEmail.calledWith("welcome").should.equal true
					done()


		it "should call the ReferalAllocator", (done)->
			done()



should = require('chai').should()
SandboxedModule = require('sandboxed-module')
assert = require('assert')
path = require('path')
modulePath = path.join __dirname, '../../../../app/js/Features/User/UserRegistrationHandler'

describe "UserRegistrationHandler", ->
	
	beforeEach ->
		@handler = SandboxedModule.require modulePath, requires:{}
		@passingRequest = {body:{email:"something@email.com", password:"123"}}


	describe 'validate Register Request', ->


		it 'allow working account through', ->
			@handler.validateRegisterRequest @passingRequest, (err, data)=>
				should.not.exist(err)
				data.first_name.should.equal "something"
				data.last_name.should.equal ""
				data.email.should.equal @passingRequest.body.email
				data.password.should.equal @passingRequest.body.password
		
		it 'not allow not valid email through ', (done)->
			@passingRequest.body.email = "notemail"
			@handler.validateRegisterRequest @passingRequest, (err, data)->
				should.exist(err)
				err.should.equal "not valid email"
				done()
		
		it 'not allow no email through ', ->
			@passingRequest.body.email = ""
			@handler.validateRegisterRequest @passingRequest, (err, data)->
				should.exist(err)
				err.should.equal "please fill in all the fields"
		
		it 'not allow no password through ', (done)->
			@passingRequest.body.password= ""
			@handler.validateRegisterRequest @passingRequest, (err, data)->
				should.exist(err)
				err.should.equal "please fill in all the fields"
				done()

		it 'trim white space from email', (done)->
			@passingRequest.body.email = " some@email.com "
			@handler.validateRegisterRequest @passingRequest, (err, data)->
				should.not.exist(err)
				data.email.should.equal "some@email.com"
				done()

		it 'lower case email', (done)->
			@passingRequest.body.email = "soMe@eMail.cOm"
			@handler.validateRegisterRequest @passingRequest, (err, data)->
				should.not.exist(err)
				data.email.should.equal "some@email.com"
				done()

		it 'should allow a short registeration request through', (done) ->
			@handler.validateRegisterRequest body: {
				email: "user_name@example.com"
				password: @passingRequest.body.password
			}, (err, data) =>
				should.not.exist(err)
				data.email.should.equal "user_name@example.com"
				data.password.should.equal @passingRequest.body.password
				data.first_name.should.equal "user_name"
				done()



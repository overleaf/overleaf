sinon = require('sinon')
chai = require('chai')
assert = require("assert")
should = chai.should()
modulePath = "../../../../app/js/Features/User/UserCreator.js"
SandboxedModule = require('sandboxed-module')

describe "UserCreator", ->

	beforeEach ->
		self = @
		@user = {_id:"12390i", ace: {}}
		@user.save = sinon.stub().callsArgWith(0)
		@UserModel = class Project
			constructor: ->
				return self.user

		@UserGetter =
			getUserByMainEmail: sinon.stub()
		@UserCreator = SandboxedModule.require modulePath, requires:
			"../../models/User": User:@UserModel
			"./UserGetter":@UserGetter
			"logger-sharelatex":{log:->}
			'metrics-sharelatex': {timeAsyncMethod: ()->}

		@email = "bob.oswald@gmail.com"

	describe "createNewUser", ->

		it "should take the opts and put them in the model", (done)->
			opts =
				email:@email
				holdingAccount:true
			@UserCreator.createNewUser opts, (err, user)=>
				assert.equal user.email, @email
				assert.equal user.holdingAccount, true
				assert.equal user.first_name, "bob.oswald"
				done()

		it "should use the start of the email if the first name is empty string", (done)->
			opts =
				email:@email
				holdingAccount:true
				first_name:""
			@UserCreator.createNewUser opts, (err, user)=>
				assert.equal user.email, @email
				assert.equal user.holdingAccount, true
				assert.equal user.first_name, "bob.oswald"
				done()


		it "should use the first name if passed", (done)->
			opts =
				email:@email
				holdingAccount:true
				first_name:"fiiirstname"
			@UserCreator.createNewUser opts, (err, user)=>
				assert.equal user.email, @email
				assert.equal user.holdingAccount, true
				assert.equal user.first_name, "fiiirstname"
				done()

		it "should use the last name if passed", (done)->
			opts =
				email:@email
				holdingAccount:true
				last_name:"lastNammmmeee"
			@UserCreator.createNewUser opts, (err, user)=>
				assert.equal user.email, @email
				assert.equal user.holdingAccount, true
				assert.equal user.last_name, "lastNammmmeee"
				done()

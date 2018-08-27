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
		@addAffiliation = sinon.stub().yields()
		@UserCreator = SandboxedModule.require modulePath, requires:
			"../../models/User": User:@UserModel
			"logger-sharelatex":{ log: sinon.stub(), err: sinon.stub() }
			'metrics-sharelatex': {timeAsyncMethod: ()->}
			"../Institutions/InstitutionsAPI": addAffiliation: @addAffiliation

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

		it "should set emails attribute", (done)->
			@UserCreator.createNewUser email: @email, (err, user)=>
				user.email.should.equal @email
				user.emails.length.should.equal 1
				user.emails[0].email.should.equal @email
				user.emails[0].createdAt.should.be.a 'date'
				done()

		it "should add affiliation in background", (done)->
			@UserCreator.createNewUser email: @email, (err, user) =>
				# addaffiliation should not be called before the callback but only after
				# a tick of the event loop
				sinon.assert.notCalled(@addAffiliation)
				process.nextTick () =>
					sinon.assert.calledWith(@addAffiliation, user._id, user.email)
					done()

		it "should not add affiliation if skipping", (done)->
			attributes =  email: @email
			options = skip_affiliation: true
			@UserCreator.createNewUser attributes, options, (err, user) =>
				process.nextTick () =>
					sinon.assert.notCalled(@addAffiliation)
					done()

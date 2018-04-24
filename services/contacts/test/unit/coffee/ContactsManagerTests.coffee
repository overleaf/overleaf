sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/ContactManager.js"
SandboxedModule = require('sandboxed-module')
ObjectId = require("mongojs").ObjectId
tk = require("timekeeper")

describe "ContactManager", ->
	beforeEach ->
		tk.freeze(Date.now())
		@ContactManager = SandboxedModule.require modulePath, requires:
			"./mongojs": {
				db: @db = contacts: {}
				ObjectId: ObjectId
			},
			'logger-sharelatex': {log: sinon.stub()},
			'metrics-sharelatex': {timeAsyncMethod: sinon.stub()}
		@user_id = ObjectId().toString()
		@contact_id = ObjectId().toString()
		@callback = sinon.stub()
	
	afterEach ->
		tk.reset()

	describe "touchContact", ->
		beforeEach ->
			@db.contacts.update = sinon.stub().callsArg(3)
		
		describe "with a valid user_id", ->
			beforeEach ->
				@ContactManager.touchContact @user_id, @contact_id = "mock_contact", @callback
			
			it "should increment the contact count and timestamp", ->
				@db.contacts.update
					.calledWith({
						user_id: sinon.match((o) => o.toString() == @user_id.toString())
					}, {
						$inc:
							"contacts.mock_contact.n": 1
						$set:
							"contacts.mock_contact.ts": new Date()
					}, {
						upsert: true
					})
					.should.equal true
			
			it "should call the callback", ->
				@callback.called.should.equal true
		
		describe "with an invalid user id", ->
			beforeEach ->
				@ContactManager.touchContact "not-valid-object-id", @contact_id, @callback
			
			it "should call the callback with an error", ->
				@callback.calledWith(new Error()).should.equal true
	
	describe "getContacts", ->
		beforeEach ->
			@user = {
				contacts: ["mock", "contacts"]
			}
			@db.contacts.findOne = sinon.stub().callsArgWith(1, null, @user)
		
		describe "with a valid user_id", ->
			beforeEach ->
				@ContactManager.getContacts @user_id, @callback
			
			it "should find the user's contacts", ->
				@db.contacts.findOne
					.calledWith({
						user_id: sinon.match((o) => o.toString() == @user_id.toString())
					})
					.should.equal true
			
			it "should call the callback with the contacts", ->
				@callback.calledWith(null, @user.contacts).should.equal true
		
		describe "with an invalid user id", ->
			beforeEach ->
				@ContactManager.getContacts "not-valid-object-id", @callback
			
			it "should call the callback with an error", ->
				@callback.calledWith(new Error()).should.equal true
		

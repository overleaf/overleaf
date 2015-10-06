sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/HttpController.js"
SandboxedModule = require('sandboxed-module')

describe "HttpController", ->
	beforeEach ->
		@HttpController = SandboxedModule.require modulePath, requires:
			"./ContactManager": @ContactManager = {}
			"./WebApiManager": @WebApiManager = {}
			"logger-sharelatex": @logger = { log: sinon.stub() }
		@user_id = "mock-user-id"
		@contact_id = "mock-contact-id"
		
		@req = {}
		@res = {}
		@res.status = sinon.stub().returns @res
		@res.end = sinon.stub()
		@res.send = sinon.stub()
		@next = sinon.stub()

	describe "addContact", ->
		beforeEach ->
			@req.params =
				user_id: @user_id
			@ContactManager.touchContact = sinon.stub().callsArg(2)
		
		describe "with a valid user_id and contact_id", ->
			beforeEach ->
				@req.body =
					contact_id: @contact_id
				@HttpController.addContact @req, @res, @next
			
			it "should update the contact in the user's contact list", ->
				@ContactManager.touchContact
					.calledWith(@user_id, @contact_id)
					.should.equal true
			
			it "should update the user in the contact's contact list", ->
				@ContactManager.touchContact
					.calledWith(@contact_id, @user_id)
					.should.equal true
			
			it "should send back a 204 status", ->
				@res.status.calledWith(204).should.equal true
				@res.end.called.should.equal true
		
		describe "with an invalid contact id", ->
			beforeEach ->
				@req.body =
					contact_id: ""
				@HttpController.addContact @req, @res, @next
			
			it "should return 400, Bad Request", ->
				@res.status.calledWith(400).should.equal true
				@res.send.calledWith("contact_id should be a non-blank string").should.equal true

	describe "getContacts", ->
		beforeEach ->
			@req.params =
				user_id: @user_id
			now = Date.now()
			@contacts = {
				"user-id-1": { n: 2, ts: new Date(now) }
				"user-id-2": { n: 4, ts: new Date(now) }
				"user-id-3": { n: 2, ts: new Date(now - 1000) }
			}
			@user_details = {
				"user-id-1": { _id: "user-id-1", email: "joe@example.com", first_name: "Joe", last_name: "Example", extra: "foo" }
				"user-id-2": { _id: "user-id-2", email: "jane@example.com", first_name: "Sarah", last_name: "Example", extra: "foo" }
				"user-id-3": { _id: "user-id-3", email: "sam@example.com", first_name: "Sam", last_name: "Example", extra: "foo" }
			}
			@ContactManager.getContacts = sinon.stub().callsArgWith(1, null, @contacts)
			@WebApiManager.getUserDetails = (user_id, callback = (error, user) ->) =>
				callback null, @user_details[user_id]
			sinon.spy @WebApiManager, "getUserDetails"

		describe "normally", ->
			beforeEach ->
				@HttpController.getContacts @req, @res, @next
				
			it "should look up the contacts in mongo", ->
				@ContactManager.getContacts
					.calledWith(@user_id)
					.should.equal true
			
			it "should look up each contact in web for their details", ->
				for user_id, data of @contacts
					@WebApiManager.getUserDetails
						.calledWith(user_id)
						.should.equal true
			
			it "should return a sorted list of contacts by count and timestamp", ->
				@res.send
					.calledWith({
						contacts: [
							{ id: "user-id-2", email: "jane@example.com", first_name: "Sarah", last_name: "Example" }
							{ id: "user-id-1", email: "joe@example.com", first_name: "Joe", last_name: "Example" }
							{ id: "user-id-3", email: "sam@example.com", first_name: "Sam", last_name: "Example" }
						]
					})
					.should.equal true
		
		describe "with more contacts than the limit", ->
			beforeEach ->
				@req.query =
					limit: 2
				@HttpController.getContacts @req, @res, @next

			it "should return the most commonly used contacts up to the limit", ->
				@res.send
					.calledWith({
						contacts: [
							{ id: "user-id-2", email: "jane@example.com", first_name: "Sarah", last_name: "Example" }
							{ id: "user-id-1", email: "joe@example.com", first_name: "Joe", last_name: "Example" }
						]
					})
					.should.equal true
		
		describe "without a contact list", ->
			beforeEach ->
				@ContactManager.getContacts = sinon.stub().callsArgWith(1, null, null)
				@HttpController.getContacts @req, @res, @next

			it "should return an empty list", ->
				@res.send
					.calledWith({
						contacts: []
					})
					.should.equal true
		
		describe "with a holding account", ->
			it "should not return holding accounts"
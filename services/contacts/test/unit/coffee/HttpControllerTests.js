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
			@ContactManager.getContacts = sinon.stub().callsArgWith(1, null, @contacts)

		describe "normally", ->
			beforeEach ->
				@HttpController.getContacts @req, @res, @next
				
			it "should look up the contacts in mongo", ->
				@ContactManager.getContacts
					.calledWith(@user_id)
					.should.equal true
			
			it "should return a sorted list of contacts by count and timestamp", ->
				@res.send
					.calledWith({
						contact_ids: [
							"user-id-2"
							"user-id-1"
							"user-id-3"
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
						contact_ids: [
							"user-id-2"
							"user-id-1"
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
						contact_ids: []
					})
					.should.equal true
		
		describe "with a holding account", ->
			it "should not return holding accounts"
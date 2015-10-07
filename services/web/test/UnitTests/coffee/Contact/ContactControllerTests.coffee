sinon = require('sinon')
chai = require('chai')
should = chai.should()
assert = chai.assert
expect = chai.expect
modulePath = "../../../../app/js/Features/Contacts/ContactController.js"
SandboxedModule = require('sandboxed-module')

describe "ContactController", ->
	beforeEach ->
		@ContactController = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": @logger = { log: sinon.stub(), error: sinon.stub() }
			"../User/UserGetter": @UserGetter = {}
			"./ContactManager": @ContactManager = {}
			"../Authentication/AuthenticationController": @AuthenticationController = {}

		@next = sinon.stub()
		@req = {}
		@res = {}
		@res.status = sinon.stub().returns @req
		@res.send = sinon.stub()

	describe "getContacts", ->
		beforeEach ->
			@user_id = "mock-user-id"
			@contact_ids = ["contact-1", "contact-2", "contact-3"]
			@contacts = [
				{ _id: "contact-1", email: "joe@example.com", first_name: "Joe", last_name: "Example", unsued: "foo" }
				{ _id: "contact-2", email: "jane@example.com", first_name: "Jane", last_name: "Example", unsued: "foo", holdingAccount: true }
				{ _id: "contact-3", email: "jim@example.com", first_name: "Jim", last_name: "Example", unsued: "foo" }
			]
			@AuthenticationController.getLoggedInUserId = sinon.stub().callsArgWith(1, null, @user_id)
			@ContactManager.getContactIds = sinon.stub().callsArgWith(2, null, @contact_ids)
			@UserGetter.getUsers = sinon.stub().callsArgWith(2, null, @contacts)
			
			@ContactController.getContacts @req, @res, @next
			
		it "should look up the logged in user id", ->
			@AuthenticationController.getLoggedInUserId
				.calledWith(@req)
				.should.equal true
		
		it "should get the users contact ids", ->
			@ContactManager.getContactIds
				.calledWith(@user_id, { limit: 50 })
				.should.equal true
		
		it "should populate the users contacts ids", ->
			@UserGetter.getUsers
				.calledWith(@contact_ids, { email: 1, first_name: 1, last_name: 1, holdingAccount: 1 })
				.should.equal true
		
		it "should return a formatted list of contacts in contact list order, without holding accounts", ->
			@res.send.args[0][0].contacts.should.deep.equal [
				{ id: "contact-1", email: "joe@example.com", first_name: "Joe", last_name: "Example" }
				{ id: "contact-3", email: "jim@example.com", first_name: "Jim", last_name: "Example" }
			]

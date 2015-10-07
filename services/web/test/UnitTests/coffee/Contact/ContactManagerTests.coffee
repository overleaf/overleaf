chai = require('chai')
chai.should()
sinon = require("sinon")
modulePath = "../../../../app/js/Features/Contacts/ContactManager"
SandboxedModule = require('sandboxed-module')

describe "ContactManager", ->
	beforeEach ->
		@ContactManager = SandboxedModule.require modulePath, requires:
			"request" : @request = sinon.stub()
			"settings-sharelatex": @settings =
				apis:
					contacts:
						url: "contacts.sharelatex.com"
			"logger-sharelatex": @logger = {log: sinon.stub(), error: sinon.stub(), err:->}

		@user_id = "user-id-123"
		@contact_id = "contact-id-123"
		@callback = sinon.stub()

	describe "getContacts", ->
		describe "with a successful response code", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, null, statusCode: 204, { contact_ids: @contact_ids = ["mock", "contact_ids"]})
				@ContactManager.getContactIds @user_id, { limit: 42 }, @callback

			it "should get the contacts from the contacts api", ->
				@request.get
					.calledWith({
						url: "#{@settings.apis.contacts.url}/user/#{@user_id}/contacts"
						qs: { limit: 42 }
						json: true
						jar: false
					})
					.should.equal true

			it "should call the callback with the contatcs", ->
				@callback.calledWith(null, @contact_ids).should.equal true

		describe "with a failed response code", ->
			beforeEach ->
				@request.get = sinon.stub().callsArgWith(1, null, statusCode: 500, null)
				@ContactManager.getContactIds @user_id, { limit: 42 }, @callback

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("contacts api responded with non-success code: 500")).should.equal true

			it "should log the error", ->
				@logger.error
					.calledWith({
						err: new Error("contacts api responded with a non-success code: 500")
						user_id: @user_id
					}, "error getting contacts for user")
					.should.equal true

	describe "addContact", ->
		describe "with a successful response code", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, statusCode: 200, null)
				@ContactManager.addContact @user_id, @contact_id, @callback

			it "should add the contacts for the user in the contacts api", ->
				@request.post
					.calledWith({
						url: "#{@settings.apis.contacts.url}/user/#{@user_id}/contacts"
						json: {
							contact_id: @contact_id
						}
						jar: false
					})
					.should.equal true

			it "should call the callback", ->
				@callback.called.should.equal true

		describe "with a failed response code", ->
			beforeEach ->
				@request.post = sinon.stub().callsArgWith(1, null, statusCode: 500, null)
				@ContactManager.addContact @user_id, @contact_id, @callback

			it "should call the callback with an error", ->
				@callback.calledWith(new Error("contacts api responded with non-success code: 500")).should.equal true

			it "should log the error", ->
				@logger.error
					.calledWith({
						err: new Error("contacts api responded with a non-success code: 500")
						user_id: @user_id
						contact_id: @contact_id
					}, "error adding contact for user")
					.should.equal true

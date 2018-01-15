chai = require('chai')
chai.should()
expect = chai.expect
sinon = require("sinon")
modulePath = "../../../../app/js/Features/History/HistoryManager"
SandboxedModule = require('sandboxed-module')

describe "HistoryManager", ->
	beforeEach ->
		@callback = sinon.stub()
		@user_id = "user-id-123"
		@AuthenticationController =
			getLoggedInUserId: sinon.stub().returns(@user_id)
		@HistoryManager = SandboxedModule.require modulePath, requires:
			"request" : @request = sinon.stub()
			"settings-sharelatex": @settings = {}
			"../User/UserGetter": @UserGetter = {}
		@settings.apis =
			trackchanges:
				enabled: false
				url: "http://trackchanges.example.com"
			project_history:
				url: "http://project_history.example.com"

	describe "initializeProject", ->
		describe "with project history enabled", ->
			beforeEach ->
				@settings.apis.project_history.initializeHistoryForNewProjects = true

			describe "project history returns a successful response", ->
				beforeEach ->
					@overleaf_id = 1234
					@res = statusCode: 200
					@body = JSON.stringify(project: id: @overleaf_id)
					@request.post = sinon.stub().callsArgWith(1, null, @res, @body)

					@HistoryManager.initializeProject @callback

				it "should call the project history api", ->
					@request.post.calledWith(
						url: "#{@settings.apis.project_history.url}/project"
					).should.equal true

				it "should return the callback with the overleaf id", ->
					@callback.calledWithExactly(null, { @overleaf_id }).should.equal true

			describe "project history returns a response without the project id", ->
				beforeEach ->
					@res = statusCode: 200
					@body = JSON.stringify(project: {})
					@request.post = sinon.stub().callsArgWith(1, null, @res, @body)

					@HistoryManager.initializeProject @callback

				it "should return the callback with an error", ->
					@callback
						.calledWith(sinon.match.has("message", "project-history did not provide an id"))
						.should.equal true

			describe "project history returns a unsuccessful response", ->
				beforeEach ->
					@res = statusCode: 404
					@request.post = sinon.stub().callsArgWith(1, null, @res)

					@HistoryManager.initializeProject @callback

				it "should return the callback with an error", ->
					@callback
						.calledWith(sinon.match.has("message", "project-history returned a non-success status code: 404"))
						.should.equal true

			describe "project history errors", ->
				beforeEach ->
					@error = sinon.stub()
					@request.post = sinon.stub().callsArgWith(1, @error)

					@HistoryManager.initializeProject @callback

				it "should return the callback with the error", ->
					@callback.calledWithExactly(@error).should.equal true

		describe "with project history disabled", ->
			beforeEach ->
				@settings.apis.project_history.initializeHistoryForNewProjects = false
				@HistoryManager.initializeProject @callback

			it "should return the callback", ->
				@callback.calledWithExactly().should.equal true

	describe "injectUserDetails", ->
		beforeEach ->
			@user1 = {
				_id: @user_id1 = "123456"
				first_name: "Jane",
				last_name: "Doe"
				email: "jane@example.com"
			}
			@user1_view = {
				id: @user_id1
				first_name: "Jane",
				last_name: "Doe"
				email: "jane@example.com"
			}
			@user2 = {
				_id: @user_id2 = "abcdef"
				first_name: "John",
				last_name: "Doe"
				email: "john@example.com"
			}
			@user2_view = {
				id: @user_id2
				first_name: "John",
				last_name: "Doe"
				email: "john@example.com"
			}
			@UserGetter.getUsers = sinon.stub().yields(null, [@user1, @user2])

		describe "with a diff", ->
			it "should turn user_ids into user objects", (done) ->
				@HistoryManager.injectUserDetails {
					diff: [{
						i: "foo"
						meta:
							users: [@user_id1]
					}, {
						i: "bar"
						meta:
							users: [@user_id2]
					}]
				}, (error, diff) =>
					expect(error).to.be.null
					expect(diff.diff[0].meta.users).to.deep.equal [@user1_view]
					expect(diff.diff[1].meta.users).to.deep.equal [@user2_view]
					done()

			it "should leave user objects", (done) ->
				@HistoryManager.injectUserDetails {
					diff: [{
						i: "foo"
						meta:
							users: [@user1_view]
					}, {
						i: "bar"
						meta:
							users: [@user_id2]
					}]
				}, (error, diff) =>
					expect(error).to.be.null
					expect(diff.diff[0].meta.users).to.deep.equal [@user1_view]
					expect(diff.diff[1].meta.users).to.deep.equal [@user2_view]
					done()

		describe "with a list of updates", ->
			it "should turn user_ids into user objects", (done) ->
				@HistoryManager.injectUserDetails {
					updates: [{
						fromV: 5
						toV: 8
						meta:
							users: [@user_id1]
					}, {
						fromV: 4 
						toV: 5
						meta:
							users: [@user_id2]
					}]
				}, (error, updates) =>
					expect(error).to.be.null
					expect(updates.updates[0].meta.users).to.deep.equal [@user1_view]
					expect(updates.updates[1].meta.users).to.deep.equal [@user2_view]
					done()

			it "should leave user objects", (done) ->
				@HistoryManager.injectUserDetails {
					updates: [{
						fromV: 5
						toV: 8
						meta:
							users: [@user1_view]
					}, {
						fromV: 4 
						toV: 5
						meta:
							users: [@user_id2]
					}]
				}, (error, updates) =>
					expect(error).to.be.null
					expect(updates.updates[0].meta.users).to.deep.equal [@user1_view]
					expect(updates.updates[1].meta.users).to.deep.equal [@user2_view]
					done()
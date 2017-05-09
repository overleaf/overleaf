sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/RangesManager.js"
SandboxedModule = require('sandboxed-module')

describe "RangesManager", ->
	beforeEach ->
		@RangesManager = SandboxedModule.require modulePath,
			requires:
				"logger-sharelatex": @logger = { error: sinon.stub(), log: sinon.stub(), warn: sinon.stub() }
		@doc_id = "doc-id-123"
		@project_id = "project-id-123"
		@user_id = "user-id-123"
		@callback = sinon.stub()

	describe "applyUpdate", ->
		beforeEach ->
			@updates = [{
				meta:
					user_id: @user_id
				op: [{
					i: "two "
					p: 4
				}]
			}]
			@entries = {
				comments: [{
					op:
						c: "three "
						p: 4
					metadata:
						user_id: @user_id
				}]
				changes: [{
					op:
						i: "five"
						p: 15
					metadata:
						user_id: @user_id
				}]
			}
			@newDocLines = ["one two three four five"] # old is "one three four five"
		
		describe "successfully", ->
			beforeEach ->
				@RangesManager.applyUpdate @project_id, @doc_id, @entries, @updates, @newDocLines, @callback
			
			it "should return the modified the comments and changes", ->
				@callback.called.should.equal true
				[error, entries] = @callback.args[0]
				expect(error).to.be.null
				entries.comments[0].op.should.deep.equal {
					c: "three "
					p: 8
				}
				entries.changes[0].op.should.deep.equal {
					i: "five"
					p: 19
				}
		
		describe "with empty comments", ->
			beforeEach ->
				@entries.comments = []
				@RangesManager.applyUpdate @project_id, @doc_id, @entries, @updates, @newDocLines, @callback
			
			it "should return an object with no comments", ->
				# Save space in redis and don't store just {}
				@callback.called.should.equal true
				[error, entries] = @callback.args[0]
				expect(error).to.be.null
				expect(entries.comments).to.be.undefined
		
		describe "with empty changes", ->
			beforeEach ->
				@entries.changes = []
				@RangesManager.applyUpdate @project_id, @doc_id, @entries, @updates, @newDocLines, @callback
			
			it "should return an object with no changes", ->
				# Save space in redis and don't store just {}
				@callback.called.should.equal true
				[error, entries] = @callback.args[0]
				expect(error).to.be.null
				expect(entries.changes).to.be.undefined
	
		describe "with too many comments", ->
			beforeEach ->
				@RangesManager.MAX_COMMENTS = 2
				@updates = [{
					meta:
						user_id: @user_id
					op: [{
						c: "one"
						p: 0
						t: "thread-id-1"
					}]
				}]
				@entries = {
					comments: [{
						op:
							c: "three "
							p: 4
							t: "thread-id-2"
						metadata:
							user_id: @user_id
					}, {
						op:
							c: "four "
							p: 10
							t: "thread-id-3"
						metadata:
							user_id: @user_id
					}]
					changes: []
				}
				@RangesManager.applyUpdate @project_id, @doc_id, @entries, @updates, @newDocLines, @callback
			
			it "should return an error", ->
				@callback.called.should.equal true
				[error, entries] = @callback.args[0]
				expect(error).to.not.be.null
				expect(error.message).to.equal("too many comments or tracked changes")
		
		describe "with too many changes", ->
			beforeEach ->
				@RangesManager.MAX_CHANGES = 2
				@updates = [{
					meta:
						user_id: @user_id
						tc: "track-changes-id-yes"
					op: [{
						i: "one "
						p: 0
					}]
				}]
				@entries = {
					changes: [{
						op:
							i: "three"
							p: 4
						metadata:
							user_id: @user_id
					}, {
						op:
							i: "four"
							p: 10
						metadata:
							user_id: @user_id
					}]
					comments: []
				}
				@newDocLines = ["one two three four"]
				@RangesManager.applyUpdate @project_id, @doc_id, @entries, @updates, @newDocLines, @callback
			
			it "should return an error", ->
				# Save space in redis and don't store just {}
				@callback.called.should.equal true
				[error, entries] = @callback.args[0]
				expect(error).to.not.be.null
				expect(error.message).to.equal("too many comments or tracked changes")
		
		describe "inconsistent changes", ->
			beforeEach ->
				@updates = [{
					meta:
						user_id: @user_id
					op: [{
						c: "doesn't match"
						p: 0
					}]
				}]
				@RangesManager.applyUpdate @project_id, @doc_id, @entries, @updates, @newDocLines, @callback
			
			it "should return an error", ->
				# Save space in redis and don't store just {}
				@callback.called.should.equal true
				[error, entries] = @callback.args[0]
				expect(error).to.not.be.null
				expect(error.message).to.equal("Change ({\"op\":{\"i\":\"five\",\"p\":15},\"metadata\":{\"user_id\":\"user-id-123\"}}) doesn't match text (\"our \")")

	describe "acceptChanges", ->
		beforeEach ->
			@ranges = { entries: "mock", comments: "mock" }

		describe "successfully with a single change", ->
			beforeEach ->
				@change_id = "mock-change-id"
				@RangesManager.acceptChanges [ @change_id ], @ranges 

			it "should log the call with the correct number of changes", ->
				@logger.log
					.calledWith("accepting 1 changes in ranges")
					.should.equal true

		describe "successfully with multiple changes", ->
			beforeEach ->
				@change_ids = [ "mock-change-id-1", "mock-change-id-2", "mock-change-id-3", "mock-change-id-4" ]
				@RangesManager.acceptChanges @change_ids, @ranges

			it "should log the call with the correct number of changes", ->
				@logger.log
					.calledWith("accepting #{ @change_ids.length } changes in ranges")
					.should.equal true

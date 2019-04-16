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
				[error, entries, ranges_were_collapsed] = @callback.args[0]
				expect(error).to.be.null
				expect(ranges_were_collapsed).to.equal false
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


		describe "with an update that collapses a range", ->
			beforeEach ->
				@updates = [{
					meta:
						user_id: @user_id
					op: [{
						d: "one"
						p: 0
						t: "thread-id-1"
					}]
				}]
				@entries = {
					comments: [{
						op:
							c: "n"
							p: 1
							t: "thread-id-2"
						metadata:
							user_id: @user_id
					}]
					changes: []
				}
				@RangesManager.applyUpdate @project_id, @doc_id, @entries, @updates, @newDocLines, @callback

			it "should return ranges_were_collapsed == true", ->
				@callback.called.should.equal true
				[error, entries, ranges_were_collapsed] = @callback.args[0]
				expect(ranges_were_collapsed).to.equal true

	describe "acceptChanges", ->
		beforeEach ->
			@RangesManager = SandboxedModule.require modulePath,
				requires:
					"logger-sharelatex": @logger = { error: sinon.stub(), log: sinon.stub(), warn: sinon.stub() }
					"./RangesTracker":@RangesTracker = SandboxedModule.require "../../../../app/js/RangesTracker.js"

			@ranges = {
				comments: []
				changes: [{
					id: "a1"
					op:
						i: "lorem"
						p: 0
				}, {
					id: "a2"
					op:
						i: "ipsum"
						p: 10
				}, {
					id: "a3"
					op:
						i: "dolor"
						p: 20
				}, {
					id: "a4"
					op:
						i: "sit"
						p: 30
				}, {
					id: "a5"
					op:
						i: "amet"
						p: 40
				}]
			}
			@removeChangeIdsSpy = sinon.spy @RangesTracker.prototype, "removeChangeIds"

		describe "successfully with a single change", ->
			beforeEach (done) ->
				@change_ids = [ @ranges.changes[1].id ]
				@RangesManager.acceptChanges @change_ids, @ranges, (err, ranges) => 
					@rangesResponse = ranges
					done()

			it "should log the call with the correct number of changes", ->
				@logger.log
					.calledWith("accepting 1 changes in ranges")
					.should.equal true

			it "should delegate the change removal to the ranges tracker", ->
				@removeChangeIdsSpy
					.calledWith(@change_ids)
					.should.equal true

			it "should remove the change", ->
				expect(@rangesResponse.changes
					.find((change) => change.id ==  @ranges.changes[1].id))
					.to.be.undefined

			it "should return the original number of changes minus 1", ->
				@rangesResponse.changes.length
					.should.equal @ranges.changes.length - 1
					
			it "should not touch other changes", ->
				for i in [ 0, 2, 3, 4]
					expect(@rangesResponse.changes
						.find((change) => change.id ==  @ranges.changes[i].id))
						.to.deep.equal @ranges.changes[i]

		describe "successfully with multiple changes", ->
			beforeEach (done) ->
				@change_ids = [ @ranges.changes[1].id, @ranges.changes[3].id, @ranges.changes[4].id ]
				@RangesManager.acceptChanges @change_ids, @ranges, (err, ranges) => 
					@rangesResponse = ranges
					done()

			it "should log the call with the correct number of changes", ->
				@logger.log
					.calledWith("accepting #{ @change_ids.length } changes in ranges")
					.should.equal true

			it "should delegate the change removal to the ranges tracker", ->
				@removeChangeIdsSpy
					.calledWith(@change_ids)
					.should.equal true

			it "should remove the changes", ->
				for i in [ 1, 3, 4]
					expect(@rangesResponse.changes
						.find((change) => change.id ==  @ranges.changes[1].id))
						.to.be.undefined
			
			it "should return the original number of changes minus the number of accepted changes", ->
				@rangesResponse.changes.length
					.should.equal @ranges.changes.length - 3

			it "should not touch other changes", ->
				for i in [ 0, 2 ]
					expect(@rangesResponse.changes
						.find((change) => change.id ==  @ranges.changes[i].id))
						.to.deep.equal @ranges.changes[i]
					

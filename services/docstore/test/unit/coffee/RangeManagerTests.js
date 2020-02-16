SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
expect = require('chai').expect
modulePath = require('path').join __dirname, '../../../app/js/RangeManager'
ObjectId = require("mongojs").ObjectId
assert = require("chai").assert
_ = require "underscore"

describe "RangeManager", ->
	beforeEach ->
		@RangeManager = SandboxedModule.require modulePath, requires:
			"./mongojs":
				ObjectId: ObjectId

	describe "jsonRangesToMongo", ->
		it "should convert ObjectIds and dates to proper objects", ->
			change_id = ObjectId().toString()
			comment_id = ObjectId().toString()
			user_id = ObjectId().toString()
			thread_id = ObjectId().toString()
			ts = new Date().toJSON()
			@RangeManager.jsonRangesToMongo({
				changes: [{
					id: change_id
					op: { i: "foo", p: 3 }
					metadata:
						user_id: user_id
						ts: ts
				}]
				comments: [{
					id: comment_id
					op: { c: "foo", p: 3, t: thread_id }
				}]
			}).should.deep.equal {
				changes: [{
					id: ObjectId(change_id)
					op: { i: "foo", p: 3 }
					metadata:
						user_id: ObjectId(user_id)
						ts: new Date(ts)
				}]
				comments: [{
					id: ObjectId(comment_id)
					op: { c: "foo", p: 3, t: ObjectId(thread_id) }
				}]
			}
		
		it "should leave malformed ObjectIds as they are", ->
			change_id = "foo"
			comment_id = "bar"
			user_id = "baz"
			@RangeManager.jsonRangesToMongo({
				changes: [{
					id: change_id
					metadata:
						user_id: user_id
				}]
				comments: [{
					id: comment_id
				}]
			}).should.deep.equal {
				changes: [{
					id: change_id
					metadata:
						user_id: user_id
				}]
				comments: [{
					id: comment_id
				}]
			}
		
		it "should be consistent when transformed through json -> mongo -> json", ->
			change_id = ObjectId().toString()
			comment_id = ObjectId().toString()
			user_id = ObjectId().toString()
			thread_id = ObjectId().toString()
			ts = new Date().toJSON()
			ranges1 = {
				changes: [{
					id: change_id
					op: { i: "foo", p: 3 }
					metadata:
						user_id: user_id
						ts: ts
				}]
				comments: [{
					id: comment_id
					op: { c: "foo", p: 3, t: thread_id }
				}]
			}
			ranges1_copy = JSON.parse(JSON.stringify(ranges1)) # jsonRangesToMongo modifies in place
			ranges2 = JSON.parse(JSON.stringify(@RangeManager.jsonRangesToMongo(ranges1_copy)))
			ranges1.should.deep.equal ranges2
			
	describe "shouldUpdateRanges", ->
		beforeEach () ->
			@ranges = {
				changes: [{
					id: ObjectId()
					op: { i: "foo", p: 3 }
					metadata:
						user_id: ObjectId()
						ts: new Date()
				}]
				comments: [{
					id: ObjectId()
					op: { c: "foo", p: 3, t: ObjectId() }
				}]
			}
			@ranges_copy = @RangeManager.jsonRangesToMongo(JSON.parse(JSON.stringify(@ranges)))

		describe "with a blank new range", ->
			it "should throw an error", ->
				expect(() =>
					@RangeManager.shouldUpdateRanges(@ranges, null)
				).to.throw(Error)
		
		describe "with a blank old range", ->
			it "should treat it like {}", ->
				@RangeManager.shouldUpdateRanges(null, {}).should.equal false
				@RangeManager.shouldUpdateRanges(null, @ranges).should.equal true
		
		describe "with no changes", ->
			it "should return false", ->
				@RangeManager.shouldUpdateRanges(@ranges, @ranges_copy).should.equal false
		
		describe "with changes", ->
			it "should return true when the change id changes", ->
				@ranges_copy.changes[0].id = ObjectId()
				@RangeManager.shouldUpdateRanges(@ranges, @ranges_copy).should.equal true

			it "should return true when the change user id changes", ->
				@ranges_copy.changes[0].metadata.user_id = ObjectId()
				@RangeManager.shouldUpdateRanges(@ranges, @ranges_copy).should.equal true

			it "should return true when the change ts changes", ->
				@ranges_copy.changes[0].metadata.ts = new Date(Date.now() + 1000)
				@RangeManager.shouldUpdateRanges(@ranges, @ranges_copy).should.equal true

			it "should return true when the change op changes", ->
				@ranges_copy.changes[0].op.i = "bar"
				@RangeManager.shouldUpdateRanges(@ranges, @ranges_copy).should.equal true

			it "should return true when the comment id changes", ->
				@ranges_copy.comments[0].id = ObjectId()
				@RangeManager.shouldUpdateRanges(@ranges, @ranges_copy).should.equal true

			it "should return true when the comment offset changes", ->
				@ranges_copy.comments[0].op.p = 17
				@RangeManager.shouldUpdateRanges(@ranges, @ranges_copy).should.equal true

			it "should return true when the comment content changes", ->
				@ranges_copy.comments[0].op.c = "bar"
				@RangeManager.shouldUpdateRanges(@ranges, @ranges_copy).should.equal true
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/UpdateCompressor.js"
SandboxedModule = require('sandboxed-module')

bigstring = ("a" for [0 .. 2*1024*1024]).join("")
mediumstring = ("a" for [0 .. 1024*1024]).join("")

describe "UpdateCompressor", ->
	beforeEach ->
		@UpdateCompressor = SandboxedModule.require modulePath, requires:
			"../lib/diff_match_patch": require("../../../../app/lib/diff_match_patch")
		@user_id = "user-id-1"
		@other_user_id = "user-id-2"
		@ts1 = Date.now()
		@ts2 = Date.now() + 1000

	describe "convertToSingleOpUpdates", ->
		it "should split grouped updates into individual updates", ->
			expect(@UpdateCompressor.convertToSingleOpUpdates [{
				op:   [ @op1 = { p: 0, i: "Foo" }, @op2 = { p: 6, i: "bar"} ]
				meta: { ts: @ts1, user_id: @user_id }
				v: 42
			}, {
				op:   [ @op3 = { p: 10, i: "baz" } ]
				meta: { ts: @ts2, user_id: @other_user_id }
				v: 43
			}])
			.to.deep.equal [{
				op: @op1,
				meta: { start_ts: @ts1, end_ts: @ts1, user_id: @user_id },
				v: 42
			}, {
				op: @op2,
				meta: { start_ts: @ts1, end_ts: @ts1, user_id: @user_id },
				v: 42
			}, {
				op: @op3,
				meta: { start_ts: @ts2, end_ts: @ts2, user_id: @other_user_id },
				v: 43
			}]

		it "should return no-op updates when the op list is empty", ->
			expect(@UpdateCompressor.convertToSingleOpUpdates [{
				op:   []
				meta: { ts: @ts1, user_id: @user_id }
				v: 42
			}])
			.to.deep.equal [{
				op: @UpdateCompressor.NOOP
				meta: { start_ts: @ts1, end_ts: @ts1, user_id: @user_id },
				v: 42
			}]

		it "should ignore comment ops", ->
			expect(@UpdateCompressor.convertToSingleOpUpdates [{
				op:   [ @op1 = { p: 0, i: "Foo" }, @op2 = { p: 9, c: "baz"}, @op3 = { p: 6, i: "bar"} ]
				meta: { ts: @ts1, user_id: @user_id }
				v: 42
			}])
			.to.deep.equal [{
				op: @op1,
				meta: { start_ts: @ts1, end_ts: @ts1, user_id: @user_id },
				v: 42
			}, {
				op: @op3,
				meta: { start_ts: @ts1, end_ts: @ts1, user_id: @user_id },
				v: 42
			}]

	describe "concatUpdatesWithSameVersion", ->
		it "should concat updates with the same version", ->
			expect(@UpdateCompressor.concatUpdatesWithSameVersion [{
				op:   @op1 = { p: 0, i: "Foo" }
				meta: { start_ts: @ts1, end_ts: @ts1, user_id: @user_id }
				v: 42
			}, {
				op:   @op2 = { p: 6, i: "bar" }
				meta: { start_ts: @ts1, end_ts: @ts1, user_id: @user_id }
				v: 42
			}, {
				op:   @op3 = { p: 10, i: "baz" }
				meta: { start_ts: @ts2, end_ts: @ts2, user_id: @other_user_id }
				v: 43
			}])
			.to.deep.equal [{
				op:   [ @op1, @op2 ]
				meta: { start_ts: @ts1, end_ts: @ts1, user_id: @user_id }
				v: 42
			}, {
				op:   [ @op3 ]
				meta: {  start_ts: @ts2, end_ts: @ts2, user_id: @other_user_id }
				v: 43
			}]

		it "should turn a noop into an empty op", ->
			expect(@UpdateCompressor.concatUpdatesWithSameVersion [{
				op:   @UpdateCompressor.NOOP
				meta: { start_ts: @ts1, end_ts: @ts1, user_id: @user_id }
				v: 42
			}])
			.to.deep.equal [{
				op:   []
				meta: { start_ts: @ts1, end_ts: @ts1, user_id: @user_id }
				v: 42
			}]

	describe "compress", ->
		describe "insert - insert", ->
			it "should append one insert to the other", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, i: "foo" }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 6, i: "bar" }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 3, i: "foobar" }
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
					v: 43
				}]

			it "should insert one insert inside the other", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, i: "foo" }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 5, i: "bar" }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 3, i: "fobaro" }
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
					v: 43
				}]

			it "should not append separated inserts", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, i: "foo" }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 9, i: "bar" }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 3, i: "foo" }
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 9, i: "bar" }
					meta: start_ts: @ts2, end_ts: @ts2, user_id: @user_id
					v: 43
				}]

			it "should not append inserts that are too big (second op)", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, i: "foo" }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 6, i: bigstring }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 3, i: "foo" }
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 6, i: bigstring }
					meta: start_ts: @ts2, end_ts: @ts2, user_id: @user_id
					v: 43
				}]

			it "should not append inserts that are too big (first op)", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, i: bigstring }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 3 + bigstring.length, i: "bar" }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 3, i: bigstring }
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 3 + bigstring.length, i: "bar" }
					meta: start_ts: @ts2, end_ts: @ts2, user_id: @user_id
					v: 43
				}]

			it "should not append inserts that are too big (first and second op)", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, i: mediumstring }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 3 + mediumstring.length, i: mediumstring }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 3, i: mediumstring }
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 3 + mediumstring.length, i: mediumstring }
					meta: start_ts: @ts2, end_ts: @ts2, user_id: @user_id
					v: 43
				}]


		describe "delete - delete", ->
			it "should append one delete to the other", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, d: "foo" }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 3, d: "bar" }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 3, d: "foobar" }
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
					v: 43
				}]
				
			it "should insert one delete inside the other", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, d: "foo" }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 1, d: "bar" }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 1, d: "bafoor" }
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
					v: 43
				}]
				
			it "should not append separated deletes", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, d: "foo" }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 9, d: "bar" }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 3, d: "foo" }
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 9, d: "bar" }
					meta: start_ts: @ts2, end_ts: @ts2, user_id: @user_id
					v: 43
				}]

		describe "insert - delete", ->
			it "should undo a previous insert", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, i: "foo" }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 5, d: "o" }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 3, i: "fo" }
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
					v: 43
				}]
				
			it "should remove part of an insert from the middle", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, i: "fobaro" }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 5, d: "bar" }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 3, i: "foo" }
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
					v: 43
				}]

			it "should cancel out two opposite updates", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, i: "foo" }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 3, d: "foo" }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [
					op: { p: 3, i: "" }
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
					v: 43
				]
				
			it "should not combine separated updates", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, i: "foo" }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 9, d: "bar" }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 3, i: "foo" }
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 9, d: "bar" }
					meta: start_ts: @ts2, end_ts: @ts2, user_id: @user_id
					v: 43
				}]

			it "should not combine updates with overlap beyond the end", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, i: "foobar" }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 6, d: "bardle" }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 3, i: "foobar" }
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 6, d: "bardle" }
					meta: start_ts: @ts2, end_ts: @ts2, user_id: @user_id
					v: 43
				}]
		
		describe "delete - insert", ->
			it "should do a diff of the content", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, d: "one two three four five six seven eight" }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 3, i: "one 2 three four five six seven eight" }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 7, d: "two" }
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
					v: 43
				}, {
					op: { p: 7, i: "2" }
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
					v: 43
				}]
			
			it "should return a no-op if the delete and insert are the same", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: { p: 3, d: "one two three four five six seven eight" }
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 3, i: "one two three four five six seven eight" }
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: { p: 3, i: "" }
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
					v: 43
				}]

		describe "noop - insert", ->
			it "should leave them untouched", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: @UpdateCompressor.NOOP
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 6, i: "bar" }
					meta: ts: @ts1, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: @UpdateCompressor.NOOP
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 6, i: "bar" }
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
					v: 43
				}]

		describe "noop - delete", ->
			it "should leave them untouched", ->
				expect(@UpdateCompressor.compressUpdates [{
					op: @UpdateCompressor.NOOP
					meta: ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 6, d: "bar" }
					meta: ts: @ts1, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: @UpdateCompressor.NOOP
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
					v: 42
				}, {
					op: { p: 6, d: "bar" }
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
					v: 43
				}]

	describe "compressRawUpdates", ->
		describe "merging in-place with an array op", ->
			it "should not change the existing last updates", ->
				expect(@UpdateCompressor.compressRawUpdates {
					op: [ {"p":1000,"d":"hello"}, {"p":1000,"i":"HELLO()"} ]
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
					v: 42
				}, [{
					op: [{ p: 1006, i: "WORLD" }]
					meta: ts: @ts2, user_id: @user_id
					v: 43
				}])
				.to.deep.equal [{
					op: [{"p":1000,"d":"hello"}, {"p":1000,"i":"HELLO()"} ]
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
					v: 42
				},{
					op: [{"p":1006,"i":"WORLD"}]
					meta: start_ts: @ts2, end_ts: @ts2, user_id: @user_id
					v: 43
				}]

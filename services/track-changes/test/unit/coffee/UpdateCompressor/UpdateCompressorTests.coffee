sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/UpdateCompressor.js"
SandboxedModule = require('sandboxed-module')

describe "UpdateCompressor", ->
	beforeEach ->
		@UpdateCompressor = SandboxedModule.require modulePath
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

				

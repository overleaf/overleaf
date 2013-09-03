sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/HistoryBuilder.js"
SandboxedModule = require('sandboxed-module')

describe "HistoryBuilder", ->
	beforeEach ->
		@HistoryBuilder = SandboxedModule.require modulePath
		@user_id = "user-id-1"
		@other_user_id = "user-id-2"
		@ts1 = Date.now()
		@ts2 = Date.now() + 1000

	describe "compress", ->
		describe "insert - insert", ->
			it "should append one insert to the other", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, i: "foo" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 6, i: "bar" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal [{
					op: [ p: 3, i: "foobar" ]
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
				}]

			it "should insert one insert inside the other", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, i: "foo" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 5, i: "bar" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal [{
					op: [ p: 3, i: "fobaro" ]
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
				}]

			it "should not append separated inserts", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, i: "foo" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 9, i: "bar" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal [{
					op: [ p: 3, i: "foo" ]
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 9, i: "bar" ]
					meta: start_ts: @ts2, end_ts: @ts2, user_id: @user_id
				}]

		describe "delete - delete", ->
			it "should append one delete to the other", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, d: "foo" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 3, d: "bar" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal [{
					op: [ p: 3, d: "foobar" ]
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
				}]
				
			it "should insert one delete inside the other", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, d: "foo" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 1, d: "bar" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal [{
					op: [ p: 1, d: "bafoor" ]
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
				}]
				
			it "should not append separated deletes", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, d: "foo" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 9, d: "bar" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal [{
					op: [ p: 3, d: "foo" ]
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 9, d: "bar" ]
					meta: start_ts: @ts2, end_ts: @ts2, user_id: @user_id
				}]

		describe "insert - delete", ->
			it "should undo a previous insert", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, i: "foo" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 5, d: "o" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal [{
					op: [ p: 3, i: "fo" ]
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
				}]
				
			it "should remove part of an insert from the middle", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, i: "fobaro" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 5, d: "bar" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal [{
					op: [ p: 3, i: "foo" ]
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
				}]

			it "should cancel out two opposite updates", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, i: "foo" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 3, d: "foo" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal []
				
			it "should not combine separated updates", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, i: "foo" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 9, d: "bar" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal [{
					op: [ p: 3, i: "foo" ]
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 9, d: "bar" ]
					meta: start_ts: @ts2, end_ts: @ts2, user_id: @user_id
				}]

		describe "delete - insert", ->
			it "should redo a previous delete at the beginning", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, d: "foo" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 3, i: "f" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal [{
					op: [ p: 4, d: "oo" ]
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
				}]

			it "should redo a previous delete from halfway through", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, d: "foobar" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 3, i: "oo" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal [{
					op: [ p: 3, d: "f" ]
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 5, d: "bar" ]
					meta: start_ts: @ts2, end_ts: @ts2, user_id: @user_id
				}]

			it "should keep words together", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, d: "abcdefghijklmnopqrstuvwxyz hello world" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 3, i: "w" ]
					meta: ts: @ts2, user_id: @user_id
				}, {
					op: [ p: 4, i: "o" ]
					meta: ts: @ts2, user_id: @user_id
				}, {
					op: [ p: 5, i: "r" ]
					meta: ts: @ts2, user_id: @user_id
				}, {
					op: [ p: 6, i: "l" ]
					meta: ts: @ts2, user_id: @user_id
				}, {
					op: [ p: 7, i: "d" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal [{
					op: [ p: 3, d: "abcdefghijklmnopqrstuvwxyz hello " ]
					meta: start_ts: @ts1, end_ts: @ts2, user_id: @user_id
				}]
				

			it "should not combine the ops if the insert text does not match the delete text", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, d: "foobar" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 3, i: "xy" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal [{
					op: [ p: 3, d: "foobar" ]
					meta: start_ts: @ts1, end_ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 3, i: "xy" ]
					meta: start_ts: @ts2, end_ts: @ts2, user_id: @user_id
				}]

			it "should cancel two equal updates", ->
				expect(@HistoryBuilder.compressUpdates [{
					op: [ p: 3, d: "foo" ]
					meta: ts: @ts1, user_id: @user_id
				}, {
					op: [ p: 3, i: "foo" ]
					meta: ts: @ts2, user_id: @user_id
				}])
				.to.deep.equal []
				

				
				

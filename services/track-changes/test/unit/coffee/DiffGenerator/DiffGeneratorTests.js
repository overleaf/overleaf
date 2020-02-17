sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/DiffGenerator.js"
SandboxedModule = require('sandboxed-module')

describe "DiffGenerator", ->
	beforeEach ->
		@DiffGenerator = SandboxedModule.require modulePath, requires:
			"logger-sharelatex": { warn: sinon.stub() }
		@ts = Date.now()
		@user_id = "mock-user-id"
		@user_id_2 = "mock-user-id-2"
		@meta = {
			start_ts: @ts, end_ts: @ts, user_id: @user_id
		}

	describe "rewindOp", ->
		describe "rewinding an insert", ->
			it "should undo the insert", ->
				content = "hello world"
				rewoundContent = @DiffGenerator.rewindOp content, { p: 6, i: "wo" }
				rewoundContent.should.equal "hello rld"

		describe "rewinding a delete", ->
			it "should undo the delete", ->
				content = "hello rld"
				rewoundContent = @DiffGenerator.rewindOp content, { p: 6, d: "wo" }
				rewoundContent.should.equal "hello world"

		describe "with an inconsistent update", ->
			it "should throw an error", ->
				content = "hello world"
				expect( () =>
					@DiffGenerator.rewindOp content, { p: 6, i: "foo" }
				).to.throw(@DiffGenerator.ConsistencyError)
		
		describe "with an update which is beyond the length of the content", ->
			it "should undo the insert as if it were at the end of the content", ->
				content = "foobar"
				rewoundContent = @DiffGenerator.rewindOp content, { p: 4, i: "bar" }
				rewoundContent.should.equal "foo"

	describe "rewindUpdate", ->
		it "should rewind ops in reverse", ->
			content = "aaabbbccc"
			update =
				op: [{ p: 3, i: "bbb" }, { p: 6, i: "ccc" }]
			rewoundContent = @DiffGenerator.rewindUpdate content, update
			rewoundContent.should.equal "aaa"

	describe "rewindUpdates", ->
		it "should rewind updates in reverse", ->
			content = "aaabbbccc"
			updates = [
				{ op: [{ p: 3, i: "bbb" }] },
				{ op: [{ p: 6, i: "ccc" }] }
			]
			rewoundContent = @DiffGenerator.rewindUpdates content, updates
			rewoundContent.should.equal "aaa"

	describe "buildDiff", ->
		beforeEach ->
			@diff = [ u: "mock-diff" ]
			@content = "Hello world"
			@updates = [
				{ i: "mock-update-1" }
				{ i: "mock-update-2" }
				{ i: "mock-update-3" }
			]
			@DiffGenerator.applyUpdateToDiff = sinon.stub().returns(@diff)
			@DiffGenerator.compressDiff = sinon.stub().returns(@diff)
			@result = @DiffGenerator.buildDiff(@content, @updates)

		it "should return the diff", ->
			@result.should.deep.equal @diff

		it "should build the content into an initial diff", ->
			@DiffGenerator.applyUpdateToDiff
				.calledWith([{
					u: @content
				}], @updates[0])
				.should.equal true

		it "should apply each update", ->
			for update in @updates
				@DiffGenerator.applyUpdateToDiff
					.calledWith(sinon.match.any, update)
					.should.equal true

		it "should compress the diff", ->
			@DiffGenerator.compressDiff
				.calledWith(@diff)
				.should.equal true

	describe "compressDiff", ->
		describe "with adjacent inserts with the same user_id", ->
			it "should create one update with combined meta data and min/max timestamps", ->
				diff = @DiffGenerator.compressDiff([
					{ i: "foo", meta: { start_ts: 10, end_ts: 20, user: { id: @user_id } }}
					{ i: "bar", meta: { start_ts: 5,  end_ts: 15, user: { id: @user_id } }}
				])
				expect(diff).to.deep.equal([
					{ i: "foobar", meta: { start_ts: 5, end_ts: 20, user: { id: @user_id } }}
				])

		describe "with adjacent inserts with different user_ids", ->
			it "should leave the inserts unchanged", ->
				input = [
					{ i: "foo", meta: { start_ts: 10, end_ts: 20, user: { id: @user_id } }}
					{ i: "bar", meta: { start_ts: 5,  end_ts: 15, user: { id: @user_id_2 } }}
				]
				output = @DiffGenerator.compressDiff(input)
				expect(output).to.deep.equal(input)

		describe "with adjacent deletes with the same user_id", ->
			it "should create one update with combined meta data and min/max timestamps", ->
				diff = @DiffGenerator.compressDiff([
					{ d: "foo", meta: { start_ts: 10, end_ts: 20, user: { id: @user_id } }}
					{ d: "bar", meta: { start_ts: 5,  end_ts: 15, user: { id: @user_id } }}
				])
				expect(diff).to.deep.equal([
					{ d: "foobar", meta: { start_ts: 5, end_ts: 20, user: { id: @user_id } }}
				])

		describe "with adjacent deletes with different user_ids", ->
			it "should leave the deletes unchanged", ->
				input = [
					{ d: "foo", meta: { start_ts: 10, end_ts: 20, user: { id: @user_id } }}
					{ d: "bar", meta: { start_ts: 5,  end_ts: 15, user: { id: @user_id_2 } }}
				]
				output = @DiffGenerator.compressDiff(input)
				expect(output).to.deep.equal(input)

	describe "applyUpdateToDiff", ->
		describe "an insert", ->
			it "should insert into the middle of (u)nchanged text", ->
				diff = @DiffGenerator.applyUpdateToDiff(
					[ { u: "foobar" } ],
					{ op: [{ p: 3, i: "baz" }], meta: @meta }
				)
				expect(diff).to.deep.equal([
					{ u: "foo" }
					{ i: "baz", meta: @meta }
					{ u: "bar" }
				])

			it "should insert into the start of (u)changed text", ->
				diff = @DiffGenerator.applyUpdateToDiff(
					[ { u: "foobar" } ],
					{ op: [{ p: 0, i: "baz" }], meta: @meta }
				)
				expect(diff).to.deep.equal([
					{ i: "baz", meta: @meta }
					{ u: "foobar" }
				])

			it "should insert into the end of (u)changed text", ->
				diff = @DiffGenerator.applyUpdateToDiff(
					[ { u: "foobar" } ],
					{ op: [{ p: 6, i: "baz" }], meta: @meta }
				)
				expect(diff).to.deep.equal([
					{ u: "foobar" }
					{ i: "baz", meta: @meta }
				])

			it "should insert into the middle of (i)inserted text", ->
				diff = @DiffGenerator.applyUpdateToDiff(
					[ { i: "foobar", meta: @meta } ],
					{ op: [{ p: 3, i: "baz" }], meta: @meta }
				)
				expect(diff).to.deep.equal([
					{ i: "foo", meta: @meta }
					{ i: "baz", meta: @meta }
					{ i: "bar", meta: @meta }
				])

			it "should not count deletes in the running length total", ->
				diff = @DiffGenerator.applyUpdateToDiff(
					[
						{ d: "deleted", meta: @meta }
						{ u: "foobar" }
					],
					{ op: [{ p: 3, i: "baz" }], meta: @meta }
				)
				expect(diff).to.deep.equal([
					{ d: "deleted", meta: @meta }
					{ u: "foo" }
					{ i: "baz", meta: @meta }
					{ u: "bar" }
				])

		describe "a delete", ->
			describe "deleting unchanged text", ->
				it "should delete from the middle of (u)nchanged text", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { u: "foobazbar" } ],
						{ op: [{ p: 3, d: "baz" }], meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ u: "foo" }
						{ d: "baz", meta: @meta }
						{ u: "bar" }
					])

				it "should delete from the start of (u)nchanged text", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { u: "foobazbar" } ],
						{ op: [{ p: 0, d: "foo" }], meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ d: "foo", meta: @meta }
						{ u: "bazbar" }
					])

				it "should delete from the end of (u)nchanged text", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { u: "foobazbar" } ],
						{ op: [{ p: 6, d: "bar" }], meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ u: "foobaz" }
						{ d: "bar", meta: @meta }
					])

				it "should delete across multiple (u)changed text parts", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { u: "foo" }, { u: "baz" }, { u: "bar" } ],
						{ op: [{ p: 2, d: "obazb" }], meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ u: "fo" }
						{ d: "o", meta: @meta }
						{ d: "baz", meta: @meta }
						{ d: "b", meta: @meta }
						{ u: "ar" }
					])

			describe "deleting inserts", ->
				it "should delete from the middle of (i)nserted text", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { i: "foobazbar", meta: @meta } ],
						{ op: [{ p: 3, d: "baz" }], meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ i: "foo", meta: @meta }
						{ i: "bar", meta: @meta }
					])

				it "should delete from the start of (u)nchanged text", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { i: "foobazbar", meta: @meta } ],
						{ op: [{ p: 0, d: "foo" }], meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ i: "bazbar", meta: @meta }
					])

				it "should delete from the end of (u)nchanged text", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { i: "foobazbar", meta: @meta } ],
						{ op: [{ p: 6, d: "bar" }], meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ i: "foobaz", meta: @meta }
					])

				it "should delete across multiple (u)changed and (i)nserted text parts", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { u: "foo" }, { i: "baz", meta: @meta }, { u: "bar" } ],
						{ op: [{ p: 2, d: "obazb" }], meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ u: "fo" }
						{ d: "o", meta: @meta }
						{ d: "b", meta: @meta }
						{ u: "ar" }
					])

			describe "deleting over existing deletes", ->
				it "should delete across multiple (u)changed and (d)deleted text parts", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { u: "foo" }, { d: "baz", meta: @meta }, { u: "bar" } ],
						{ op: [{ p: 2, d: "ob" }], meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ u: "fo" }
						{ d: "o", meta: @meta }
						{ d: "baz", meta: @meta }
						{ d: "b", meta: @meta }
						{ u: "ar" }
					])

			describe "deleting when the text doesn't match", ->
				it "should throw an error when deleting from the middle of (u)nchanged text", ->
					expect(
						() => @DiffGenerator.applyUpdateToDiff(
							[ { u: "foobazbar" } ],
							{ op: [{ p: 3, d: "xxx" }], meta: @meta }
						)
					).to.throw(@DiffGenerator.ConsistencyError)

				it "should throw an error when deleting from the start of (u)nchanged text", ->
					expect(
						() => @DiffGenerator.applyUpdateToDiff(
							[ { u: "foobazbar" } ],
							{ op: [{ p: 0, d: "xxx" }], meta: @meta }
						)
					).to.throw(@DiffGenerator.ConsistencyError)

				it "should throw an error when deleting from the end of (u)nchanged text", ->
					expect(
						() => @DiffGenerator.applyUpdateToDiff(
							[ { u: "foobazbar" } ],
							{ op: [{ p: 6, d: "xxx" }] , meta: @meta }
						)
					).to.throw(@DiffGenerator.ConsistencyError)

			describe "when the last update in the existing diff is a delete", ->
				it "should insert the new update before the delete", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { u: "foo" }, { d: "bar", meta: @meta } ],
						{ op: [{ p: 3, i: "baz" }], meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ u: "foo" }
						{ i: "baz", meta: @meta }
						{ d: "bar", meta: @meta }
					])

			describe "when the only update in the existing diff is a delete", ->
				it "should insert the new update after the delete", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { d: "bar", meta: @meta } ],
						{ op: [{ p: 0, i: "baz" }], meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ d: "bar", meta: @meta }
						{ i: "baz", meta: @meta }
					])



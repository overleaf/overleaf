sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/DiffGenerator.js"
SandboxedModule = require('sandboxed-module')

describe "DiffGenerator", ->
	beforeEach ->
		@DiffGenerator = SandboxedModule.require modulePath
		@ts = Date.now()
		@user_id = "mock-user-id"
		@meta = {
			start_ts: @ts, end_ts: @ts, user_id: @user_id
		}

	describe "rewindUpdate", ->
		describe "rewinding an insert", ->
			it "should undo the insert", ->
				content = "hello world"
				update =
					op: { p: 6, i: "wo" }
				rewoundContent = @DiffGenerator.rewindUpdate content, update
				rewoundContent.should.equal "hello rld"

		describe "rewinding a delete", ->
			it "should undo the delete", ->
				content = "hello rld"
				update =
					op: { p: 6, d: "wo" }
				rewoundContent = @DiffGenerator.rewindUpdate content, update
				rewoundContent.should.equal "hello world"

		describe "with an inconsistent update", ->
			it "should throw an error", ->
				content = "hello world"
				update =
					op: { p: 6, i: "foo" }
				expect( () =>
					@DiffGenerator.rewindUpdate content, update
				).to.throw(@DiffGenerator.ConsistencyError)

	describe "rewindUpdates", ->
		it "should rewind updates in reverse", ->
			content = "aaabbbccc"
			updates = [
				{ op: { p: 3, i: "bbb" } },
				{ op: { p: 6, i: "ccc" } }
			]
			rewoundContent = @DiffGenerator.rewindUpdates content, updates
			rewoundContent.should.equal "aaa"

	describe "applyUpdateToDiff", ->
		describe "an insert", ->
			it "should insert into the middle of (u)nchanged text", ->
				diff = @DiffGenerator.applyUpdateToDiff(
					[ { u: "foobar" } ],
					{ op: { p: 3, i: "baz" }, meta: @meta }
				)
				expect(diff).to.deep.equal([
					{ u: "foo" }
					{ i: "baz", meta: @meta }
					{ u: "bar" }
				])

			it "should insert into the start of (u)changed text", ->
				diff = @DiffGenerator.applyUpdateToDiff(
					[ { u: "foobar" } ],
					{ op: { p: 0, i: "baz" }, meta: @meta }
				)
				expect(diff).to.deep.equal([
					{ i: "baz", meta: @meta }
					{ u: "foobar" }
				])

			it "should insert into the end of (u)changed text", ->
				diff = @DiffGenerator.applyUpdateToDiff(
					[ { u: "foobar" } ],
					{ op: { p: 6, i: "baz" }, meta: @meta }
				)
				expect(diff).to.deep.equal([
					{ u: "foobar" }
					{ i: "baz", meta: @meta }
				])

			it "should insert into the middle of (i)inserted text", ->
				diff = @DiffGenerator.applyUpdateToDiff(
					[ { i: "foobar", meta: @meta } ],
					{ op: { p: 3, i: "baz" }, meta: @meta }
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
					{ op: { p: 3, i: "baz" }, meta: @meta }
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
						{ op: { p: 3, d: "baz" }, meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ u: "foo" }
						{ d: "baz", meta: @meta }
						{ u: "bar" }
					])

				it "should delete from the start of (u)nchanged text", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { u: "foobazbar" } ],
						{ op: { p: 0, d: "foo" }, meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ d: "foo", meta: @meta }
						{ u: "bazbar" }
					])

				it "should delete from the end of (u)nchanged text", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { u: "foobazbar" } ],
						{ op: { p: 6, d: "bar" }, meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ u: "foobaz" }
						{ d: "bar", meta: @meta }
					])

				it "should delete across multiple (u)changed text parts", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { u: "foo" }, { u: "baz" }, { u: "bar" } ],
						{ op: { p: 2, d: "obazb" }, meta: @meta }
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
						{ op: { p: 3, d: "baz" }, meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ i: "foo", meta: @meta }
						{ i: "bar", meta: @meta }
					])

				it "should delete from the start of (u)nchanged text", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { i: "foobazbar", meta: @meta } ],
						{ op: { p: 0, d: "foo" }, meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ i: "bazbar", meta: @meta }
					])

				it "should delete from the end of (u)nchanged text", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { i: "foobazbar", meta: @meta } ],
						{ op: { p: 6, d: "bar" }, meta: @meta }
					)
					expect(diff).to.deep.equal([
						{ i: "foobaz", meta: @meta }
					])

				it "should delete across multiple (u)changed and (i)nserted text parts", ->
					diff = @DiffGenerator.applyUpdateToDiff(
						[ { u: "foo" }, { i: "baz", meta: @meta }, { u: "bar" } ],
						{ op: { p: 2, d: "obazb" }, meta: @meta }
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
						{ op: { p: 2, d: "ob" }, meta: @meta }
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
							{ op: { p: 3, d: "xxx" }, meta: @meta }
						)
					).to.throw(@DiffGenerator.ConsistencyError)

				it "should throw an error when deleting from the start of (u)nchanged text", ->
					expect(
						() => @DiffGenerator.applyUpdateToDiff(
							[ { u: "foobazbar" } ],
							{ op: { p: 0, d: "xxx" }, meta: @meta }
						)
					).to.throw(@DiffGenerator.ConsistencyError)

				it "should throw an error when deleting from the end of (u)nchanged text", ->
					expect(
						() => @DiffGenerator.applyUpdateToDiff(
							[ { u: "foobazbar" } ],
							{ op: { p: 6, d: "xxx" }, meta: @meta }
						)
					).to.throw(@DiffGenerator.ConsistencyError)



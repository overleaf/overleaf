sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/DiffCodec.js"
SandboxedModule = require('sandboxed-module')

describe "DiffCodec", ->
	beforeEach ->
		@callback = sinon.stub()
		@DiffCodec = SandboxedModule.require modulePath

	describe "diffAsShareJsOps", ->
		it "should insert new text correctly", (done) ->
			@before = ["hello world"]
			@after  = ["hello beautiful world"]
			@DiffCodec.diffAsShareJsOp @before, @after, (error, ops) ->
				expect(ops).to.deep.equal [
					i: "beautiful "
					p: 6
				]
				done()

		it "should shift later inserts by previous inserts", (done) ->
			@before = ["the boy played with the ball"]
			@after  = ["the tall boy played with the red ball"]
			@DiffCodec.diffAsShareJsOp @before, @after, (error, ops) ->
				expect(ops).to.deep.equal [
					{ i: "tall ", p: 4 }
					{ i: "red ", p: 29 }
				]
				done()

		it "should delete text correctly", (done) ->
			@before  = ["hello beautiful world"]
			@after = ["hello world"]
			@DiffCodec.diffAsShareJsOp @before, @after, (error, ops) ->
				expect(ops).to.deep.equal [
					d: "beautiful "
					p: 6
				]
				done()


		it "should shift later deletes by the first deletes", (done) ->
			@before = ["the tall boy played with the red ball"]
			@after  = ["the boy played with the ball"]
			@DiffCodec.diffAsShareJsOp @before, @after, (error, ops) ->
				expect(ops).to.deep.equal [
					{ d: "tall ", p: 4 }
					{ d: "red ", p: 24 }
				]
				done()
			
			


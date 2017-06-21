assert = require("chai").assert
sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../app/js/ImageOptimiser.js"
SandboxedModule = require('sandboxed-module')

describe "ImageOptimiser", ->

	beforeEach ->
		@child_process =
			exec : sinon.stub()

		@optimiser = SandboxedModule.require modulePath, requires:
			'child_process': @child_process
			"logger-sharelatex":
				log:->
				err:->
				warn:->

		@sourcePath = "/this/path/here.eps"
		@error = "Error"

	describe "compressPng", ->
		

		it "convert the file", (done)->
			@child_process.exec.callsArgWith(2)
			@optimiser.compressPng @sourcePath, (err)=>
				args = @child_process.exec.args[0][0]
				args.should.equal "optipng #{@sourcePath}"
				done()


		it "should return the errro the file", (done)->
			@child_process.exec.callsArgWith(2, @error)
			@optimiser.compressPng @sourcePath, (err)=>
				err.should.equal @error
				done()

		describe 'when optimiser is sigkilled', ->

			it 'should not produce an error', (done) ->
				@error = new Error('woops')
				@error.signal = 'SIGKILL'
				@child_process.exec.callsArgWith(2, @error)
				@optimiser.compressPng @sourcePath, (err)=>
					expect(err).to.equal(null)
					done()

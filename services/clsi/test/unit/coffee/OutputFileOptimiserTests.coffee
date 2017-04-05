SandboxedModule = require('sandboxed-module')
sinon = require('sinon')
require('chai').should()
modulePath = require('path').join __dirname, '../../../app/js/OutputFileOptimiser'
path = require "path"
expect = require("chai").expect
EventEmitter = require("events").EventEmitter

describe "OutputFileOptimiser", ->
	beforeEach ->
		@OutputFileOptimiser = SandboxedModule.require modulePath, requires:
			"fs": @fs = {}
			"path": @Path = {}
			"child_process": spawn: @spawn = sinon.stub()
			"logger-sharelatex": { log: sinon.stub(), warn: sinon.stub() }
			"./Metrics" : {}
		@directory = "/test/dir"
		@callback = sinon.stub()

	describe "optimiseFile", ->
		beforeEach ->
			@src = "./output.pdf"
			@dst = "./output.pdf"

		describe "when the file is not a pdf file", ->
			beforeEach (done)->
				@src = "./output.log"
				@OutputFileOptimiser.checkIfPDFIsOptimised = sinon.stub().callsArgWith(1, null, false)
				@OutputFileOptimiser.optimisePDF = sinon.stub().callsArgWith(2, null)
				@OutputFileOptimiser.optimiseFile @src, @dst, done

			it "should not check if the file is optimised", ->
				@OutputFileOptimiser.checkIfPDFIsOptimised.calledWith(@src).should.equal false

			it "should not optimise the file", ->
				@OutputFileOptimiser.optimisePDF.calledWith(@src, @dst).should.equal false

		describe "when the pdf file is not optimised", ->
			beforeEach (done) ->
				@OutputFileOptimiser.checkIfPDFIsOptimised = sinon.stub().callsArgWith(1, null, false)
				@OutputFileOptimiser.optimisePDF = sinon.stub().callsArgWith(2, null)
				@OutputFileOptimiser.optimiseFile @src, @dst, done

			it "should check if the pdf is optimised", ->
				@OutputFileOptimiser.checkIfPDFIsOptimised.calledWith(@src).should.equal true

			it "should optimise the pdf", ->
				@OutputFileOptimiser.optimisePDF.calledWith(@src, @dst).should.equal true

		describe "when the pdf file is optimised", ->
			beforeEach (done) ->
				@OutputFileOptimiser.checkIfPDFIsOptimised = sinon.stub().callsArgWith(1, null, true)
				@OutputFileOptimiser.optimisePDF = sinon.stub().callsArgWith(2, null)
				@OutputFileOptimiser.optimiseFile @src, @dst, done

			it "should check if the pdf is optimised", ->
				@OutputFileOptimiser.checkIfPDFIsOptimised.calledWith(@src).should.equal true

			it "should not optimise the pdf", ->
				@OutputFileOptimiser.optimisePDF.calledWith(@src, @dst).should.equal false

	describe "checkIfPDFISOptimised", ->
		beforeEach () ->
			@callback = sinon.stub()
			@fd = 1234
			@fs.open = sinon.stub().yields(null, @fd)
			@fs.read = sinon.stub().withArgs(@fd).yields(null, 100, new Buffer("hello /Linearized 1"))
			@fs.close = sinon.stub().withArgs(@fd).yields(null)
			@OutputFileOptimiser.checkIfPDFIsOptimised @src, @callback

		describe "for a linearised file", ->
			beforeEach () ->
				@fs.read = sinon.stub().withArgs(@fd).yields(null, 100, new Buffer("hello /Linearized 1"))
				@OutputFileOptimiser.checkIfPDFIsOptimised @src, @callback

			it "should open the file", ->
				@fs.open.calledWith(@src, "r").should.equal true

			it "should read the header", ->
				@fs.read.calledWith(@fd).should.equal true

			it "should close the file", ->
				@fs.close.calledWith(@fd).should.equal true

			it "should call the callback with a true result", ->
				@callback.calledWith(null, true).should.equal true

		describe "for an unlinearised file", ->
			beforeEach () ->
				@fs.read = sinon.stub().withArgs(@fd).yields(null, 100, new Buffer("hello not linearized 1"))
				@OutputFileOptimiser.checkIfPDFIsOptimised @src, @callback

			it "should open the file", ->
				@fs.open.calledWith(@src, "r").should.equal true

			it "should read the header", ->
				@fs.read.calledWith(@fd).should.equal true

			it "should close the file", ->
				@fs.close.calledWith(@fd).should.equal true

			it "should call the callback with a false result", ->
				@callback.calledWith(null, false).should.equal true

sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/Features/Uploads/FileTypeManager.js"
SandboxedModule = require('sandboxed-module')

describe "FileTypeManager", ->
	beforeEach ->
		@fs = {}
		@Magic = {}
		@path = "/path/to/test"
		@callback = sinon.stub()
		@FileTypeManager = SandboxedModule.require modulePath, requires:
			"fs": @fs
			"mmmagic" : Magic: (options) => @Magic

	describe "isDirectory", ->
		beforeEach ->
			@stats = {}
			@fs.stat = sinon.stub().callsArgWith(1, null, @stats)

		describe "when it is a directory", ->
			beforeEach ->
				@stats.isDirectory = sinon.stub().returns true
				@FileTypeManager.isDirectory @path, @callback

			it "should return true", ->
				@callback.calledWith(null, true).should.equal true

		describe "when it is not a directory", ->
			beforeEach ->
				@stats.isDirectory = sinon.stub().returns false
				@FileTypeManager.isDirectory @path, @callback

			it "should return false", ->
				@callback.calledWith(null, false).should.equal true

	describe "isBinary", ->
		beforeEach ->
			@stat = { size: 100 }
			@fs.stat = sinon.stub().callsArgWith(1, null, @stat)
			
		it "should return .tex files as not binary", ->
			@FileTypeManager.isBinary "file.tex", "/path/on/disk", (error, binary) ->
				binary.should.equal false

		it "should return .bib files as not binary", ->
			@FileTypeManager.isBinary "file.bib", "/path/on/disk", (error, binary) ->
				binary.should.equal false

		it "should return .bibtex files as not binary", ->
			@FileTypeManager.isBinary "file.bibtex", "/path/on/disk", (error, binary) ->
				binary.should.equal false

		it "should return .cls files as not binary", ->
			@FileTypeManager.isBinary "file.cls", "/path/on/disk", (error, binary) ->
				binary.should.equal false

		it "should return .sty files as not binary", ->
			@FileTypeManager.isBinary "file.sty", "/path/on/disk", (error, binary) ->
				binary.should.equal false

		it "should return .bst files as not binary", ->
			@FileTypeManager.isBinary "file.bst", "/path/on/disk", (error, binary) ->
				binary.should.equal false

		it "should return .eps files as binary", ->
			@FileTypeManager.isBinary "file.eps", "/path/on/disk", (error, binary) ->
				binary.should.equal true

		it "should return .dvi files as binary", ->
			@FileTypeManager.isBinary "file.dvi", "/path/on/disk", (error, binary) ->
				binary.should.equal true

		it "should return .png files as binary", ->
			@FileTypeManager.isBinary "file.png", "/path/on/disk", (error, binary) ->
				binary.should.equal true

		it "should return files without extensions as binary", ->
			@FileTypeManager.isBinary "tex", "/path/on/disk", (error, binary) ->
				binary.should.equal true

		it "should ignore the case of an extension", ->
			@FileTypeManager.isBinary "file.TEX", "/path/on/disk", (error, binary) ->
				binary.should.equal false
		
		it "should return large text files as binary", ->
			@stat.size = 2 * 1024 * 1024 # 2Mb
			@FileTypeManager.isBinary "file.tex", "/path/on/disk", (error, binary) ->
				binary.should.equal true

	describe "shouldIgnore", ->
		it "should ignore tex auxiliary files", ->
			@FileTypeManager.shouldIgnore "file.aux", (error, ignore) ->
				ignore.should.equal true

		it "should ignore dotfiles", ->
			@FileTypeManager.shouldIgnore "path/.git", (error, ignore) ->
				ignore.should.equal true

		it "should ignore __MACOSX", ->
			@FileTypeManager.shouldIgnore "path/__MACOSX", (error, ignore) ->
				ignore.should.equal true

		it "should not ignore .tex files", ->
			@FileTypeManager.shouldIgnore "file.tex", (error, ignore) ->
				ignore.should.equal false

		it "should ignore the case of the extension", ->
			@FileTypeManager.shouldIgnore "file.AUX", (error, ignore) ->
				ignore.should.equal true
			


sinon = require('sinon')
chai = require('chai')
should = chai.should()
modulePath = "../../../../app/js/Features/Uploads/FileTypeManager.js"
SandboxedModule = require('sandboxed-module')
isUtf8 = require('is-utf8')

describe "FileTypeManager", ->
	beforeEach ->
		@isUtf8 = sinon.spy(isUtf8)
		@fs = {}
		@path = "/path/to/test"
		@callback = sinon.stub()
		@ced = sinon.stub()
		@DocumentHelper =
			getEncodingFromTexContent: sinon.stub()
		@FileTypeManager = SandboxedModule.require modulePath, requires:
			"fs": @fs
			"is-utf8": @isUtf8

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

	describe "getType", ->
		beforeEach ->
			@stat = { size: 100 }
			@contents = "Ich bin eine kleine Teekanne, kurz und kräftig."
			@fs.stat = sinon.stub().callsArgWith(1, null, @stat)
			@fs.readFile = sinon.stub().callsArgWith(1, null, Buffer.from(@contents, "utf-8"))
			@fs.readFile.withArgs("/path/on/disk/utf16.tex").callsArgWith(1, null, Buffer.from("\uFEFF" + @contents, "utf-16le"))
			@fs.readFile.withArgs("/path/on/disk/latin1.tex").callsArgWith(1, null, Buffer.from(@contents, "latin1"))
			@encoding = "ASCII"

		describe "when the file extension is text", ->
			it "should return .tex files as not binary", ->
				@FileTypeManager.getType "file.tex", "/path/on/disk", (error, binary) ->
					binary.should.equal false

			it "should return .bib files as not binary", ->
				@FileTypeManager.getType "file.bib", "/path/on/disk", (error, binary) ->
					binary.should.equal false

			it "should return .bibtex files as not binary", ->
				@FileTypeManager.getType "file.bibtex", "/path/on/disk", (error, binary) ->
					binary.should.equal false

			it "should return .cls files as not binary", ->
				@FileTypeManager.getType "file.cls", "/path/on/disk", (error, binary) ->
					binary.should.equal false

			it "should return .sty files as not binary", ->
				@FileTypeManager.getType "file.sty", "/path/on/disk", (error, binary) ->
					binary.should.equal false

			it "should return .bst files as not binary", ->
				@FileTypeManager.getType "file.bst", "/path/on/disk", (error, binary) ->
					binary.should.equal false

			it "should return .latexmkrc file as not binary", ->
				@FileTypeManager.getType ".latexmkrc", "/path/on/disk", (error, binary) ->
					binary.should.equal false

			it "should return latexmkrc file as not binary", ->
				@FileTypeManager.getType "latexmkrc", "/path/on/disk", (error, binary) ->
					binary.should.equal false

			it "should return lbx file as not binary", ->
				@FileTypeManager.getType "file.lbx", "/path/on/disk", (error, binary) ->
					binary.should.equal false

			it "should return bbx file as not binary", ->
				@FileTypeManager.getType "file.bbx", "/path/on/disk", (error, binary) ->
					binary.should.equal false

			it "should return cbx file as not binary", ->
				@FileTypeManager.getType "file.cbx", "/path/on/disk", (error, binary) ->
					binary.should.equal false

			it "should return m file as not binary", ->
				@FileTypeManager.getType "file.m", "/path/on/disk", (error, binary) ->
					binary.should.equal false

			it "should ignore the case of an extension", ->
				@FileTypeManager.getType "file.TEX", "/path/on/disk", (error, binary) ->
					binary.should.equal false

			it "should return large text files as binary", ->
				@stat.size = 2 * 1024 * 1024 # 2Mb
				@FileTypeManager.getType "file.tex", "/path/on/disk", (error, binary) ->
					binary.should.equal true

			it "should return try to determine the encoding of large files", ->
				@stat.size = 2 * 1024 * 1024 # 2Mb
				@FileTypeManager.getType "file.tex", "/path/on/disk", =>
					sinon.assert.notCalled(@isUtf8)

			it "should detect the file as utf8", ->
				@FileTypeManager.getType "file.tex", "/path/on/disk", (error, binary, encoding) =>
					sinon.assert.calledOnce(@isUtf8)
					@isUtf8.returned(true).should.equal true
					encoding.should.equal "utf-8"

			it "should return 'latin1' for non-unicode encodings", ->
				@FileTypeManager.getType "file.tex", "/path/on/disk/latin1.tex", (error, binary, encoding) =>
					sinon.assert.calledOnce(@isUtf8)
					@isUtf8.returned(false).should.equal true
					encoding.should.equal "latin1"

			it "should detect utf16 with BOM as utf-16", ->
				@FileTypeManager.getType "file.tex", "/path/on/disk/utf16.tex", (error, binary, encoding) =>
					sinon.assert.calledOnce(@isUtf8)
					@isUtf8.returned(false).should.equal true
					encoding.should.equal "utf-16le"

		describe "when the file extension is non-text", ->
			it "should return .eps files as binary", ->
				@FileTypeManager.getType "file.eps", "/path/on/disk", (error, binary) ->
					binary.should.equal true

			it "should return .dvi files as binary", ->
				@FileTypeManager.getType "file.dvi", "/path/on/disk", (error, binary) ->
					binary.should.equal true

			it "should return .png files as binary", ->
				@FileTypeManager.getType "file.png", "/path/on/disk", (error, binary) ->
					binary.should.equal true

			it "should return files without extensions as binary", ->
				@FileTypeManager.getType "tex", "/path/on/disk", (error, binary) ->
					binary.should.equal true

			it "should not try to get the character encoding", ->
				@FileTypeManager.getType "file.png", "/path/on/disk", =>
					sinon.assert.notCalled(@isUtf8)

	describe "shouldIgnore", ->
		it "should ignore tex auxiliary files", ->
			@FileTypeManager.shouldIgnore "file.aux", (error, ignore) ->
				ignore.should.equal true

		it "should ignore dotfiles", ->
			@FileTypeManager.shouldIgnore "path/.git", (error, ignore) ->
				ignore.should.equal true

		it "should not ignore .latexmkrc dotfile", ->
			@FileTypeManager.shouldIgnore "path/.latexmkrc", (error, ignore) ->
				ignore.should.equal false

		it "should ignore __MACOSX", ->
			@FileTypeManager.shouldIgnore "path/__MACOSX", (error, ignore) ->
				ignore.should.equal true

		it "should not ignore .tex files", ->
			@FileTypeManager.shouldIgnore "file.tex", (error, ignore) ->
				ignore.should.equal false

		it "should ignore the case of the extension", ->
			@FileTypeManager.shouldIgnore "file.AUX", (error, ignore) ->
				ignore.should.equal true

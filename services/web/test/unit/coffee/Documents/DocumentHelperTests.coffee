sinon = require('sinon')
chai = require('chai')
should = chai.should()
expect = chai.expect
modulePath = "../../../../app/js/Features/Documents/DocumentHelper.js"
SandboxedModule = require('sandboxed-module')

describe "DocumentHelper", ->
	beforeEach ->
		@DocumentHelper = SandboxedModule.require modulePath

	describe "getTitleFromTexContent", ->

		it "should return the title", ->
			document = "\\begin{document}\n\\title{foo}\n\\end{document}"
			expect(@DocumentHelper.getTitleFromTexContent(document)).to.equal "foo"

		it "should return the title if surrounded by space", ->
			document = "\\begin{document}\n   \\title{foo}   \n\\end{document}"
			expect(@DocumentHelper.getTitleFromTexContent(document)).to.equal "foo"

		it "should return null if there is no title", ->
			document = "\\begin{document}\n\\end{document}"
			expect(@DocumentHelper.getTitleFromTexContent(document)).to.eql null

		it "should accept an array", ->
			document = ["\\begin{document}","\\title{foo}","\\end{document}"]
			expect(@DocumentHelper.getTitleFromTexContent(document)).to.equal "foo"

	describe "contentHasDocumentclass", ->
		it "should return true if the content has a documentclass", ->
			document = ["% line", "% line", "% line", "\\documentclass"]
			expect(@DocumentHelper.contentHasDocumentclass(document)).to.equal true

		it "should allow whitespace before the documentclass", ->
			document = ["% line", "% line", "% line", "        \\documentclass"]
			expect(@DocumentHelper.contentHasDocumentclass(document)).to.equal true

		it "should not allow non-whitespace before the documentclass", ->
			document = ["% line", "% line", "% line", "    asdf \\documentclass"]
			expect(@DocumentHelper.contentHasDocumentclass(document)).to.equal false

		it "should return false when there is no documentclass", ->
			document = ["% line", "% line", "% line"]
			expect(@DocumentHelper.contentHasDocumentclass(document)).to.equal false

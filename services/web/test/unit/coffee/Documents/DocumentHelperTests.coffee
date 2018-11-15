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

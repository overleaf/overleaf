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

		it "should parse out formatting elements from the title", ->
			document = "\\title{\\textbf{\\large{Second Year LaTeX Exercise}}}"
			expect(@DocumentHelper.getTitleFromTexContent(document)).to.equal "Second Year LaTeX Exercise"

		it "should ignore junk after the title", ->
			document = "\\title{wombat} potato"
			expect(@DocumentHelper.getTitleFromTexContent(document)).to.equal "wombat"

		it "should ignore junk before the title", ->
			document = "% this is something that v1 relied on, even though it seems odd \\title{wombat}"
			expect(@DocumentHelper.getTitleFromTexContent(document)).to.equal "wombat"

		# NICETOHAVE: Current implementation doesn't do this
		#it "should keep content that surrounds formatting elements", ->
		#	document = "\\title{Second Year \\large{LaTeX} Exercise}"
		#	expect(@DocumentHelper.getTitleFromTexContent(document)).to.equal "Second Year LaTeX Exercise"

		it "should collapse whitespace", ->
			document = "\\title{Second    Year  LaTeX     Exercise}"
			expect(@DocumentHelper.getTitleFromTexContent(document)).to.equal "Second Year LaTeX Exercise"

	describe "detex", ->
		# note, there are a number of tests for getTitleFromTexContent that also test cases here
		it 'leaves a non-TeX string unchanged', ->
			expect(@DocumentHelper.detex('')).to.equal ''
			expect(@DocumentHelper.detex('a')).to.equal 'a'
			expect(@DocumentHelper.detex('a a')).to.equal 'a a'

		it 'collapses spaces', ->
			expect(@DocumentHelper.detex('a  a')).to.equal 'a a'
			expect(@DocumentHelper.detex('a \n a')).to.equal 'a \n a'

		it 'replaces named commands', ->
			expect(@DocumentHelper.detex('\\LaTeX')).to.equal 'LaTeX'
			expect(@DocumentHelper.detex('\\TikZ')).to.equal 'TikZ'
			expect(@DocumentHelper.detex('\\TeX')).to.equal 'TeX'
			expect(@DocumentHelper.detex('\\BibTeX')).to.equal 'BibTeX'

		it 'removes general commands', ->
			expect(@DocumentHelper.detex('\\foo')).to.equal ''
			expect(@DocumentHelper.detex('\\foo{}')).to.equal ''
			expect(@DocumentHelper.detex('\\foo~Test')).to.equal 'Test'
			expect(@DocumentHelper.detex('\\"e')).to.equal 'e'
			expect(@DocumentHelper.detex('\\textit{e}')).to.equal 'e'

		it 'leaves basic math', ->
			expect(@DocumentHelper.detex('$\\cal{O}(n^2)$')).to.equal 'O(n^2)'
	
		it 'removes line spacing commands', ->
			expect(@DocumentHelper.detex('a \\\\[1.50cm] b')).to.equal 'a b'

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

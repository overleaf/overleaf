/* eslint-disable
    max-len,
    no-return-assign,
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS102: Remove unnecessary code created because of implicit returns
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
const sinon = require('sinon')
const chai = require('chai')
const should = chai.should()
const { expect } = chai
const modulePath = '../../../../app/src/Features/Documents/DocumentHelper.js'
const SandboxedModule = require('sandboxed-module')

describe('DocumentHelper', function() {
  beforeEach(function() {
    return (this.DocumentHelper = SandboxedModule.require(modulePath))
  })

  describe('getTitleFromTexContent', function() {
    it('should return the title', function() {
      const document = '\\begin{document}\n\\title{foo}\n\\end{document}'
      return expect(
        this.DocumentHelper.getTitleFromTexContent(document)
      ).to.equal('foo')
    })

    it('should return the title if surrounded by space', function() {
      const document = '\\begin{document}\n   \\title{foo}   \n\\end{document}'
      return expect(
        this.DocumentHelper.getTitleFromTexContent(document)
      ).to.equal('foo')
    })

    it('should return null if there is no title', function() {
      const document = '\\begin{document}\n\\end{document}'
      return expect(
        this.DocumentHelper.getTitleFromTexContent(document)
      ).to.eql(null)
    })

    it('should accept an array', function() {
      const document = ['\\begin{document}', '\\title{foo}', '\\end{document}']
      return expect(
        this.DocumentHelper.getTitleFromTexContent(document)
      ).to.equal('foo')
    })

    it('should parse out formatting elements from the title', function() {
      const document = '\\title{\\textbf{\\large{Second Year LaTeX Exercise}}}'
      return expect(
        this.DocumentHelper.getTitleFromTexContent(document)
      ).to.equal('Second Year LaTeX Exercise')
    })

    it('should ignore junk after the title', function() {
      const document = '\\title{wombat} potato'
      return expect(
        this.DocumentHelper.getTitleFromTexContent(document)
      ).to.equal('wombat')
    })

    it('should ignore junk before the title', function() {
      const document =
        '% this is something that v1 relied on, even though it seems odd \\title{wombat}'
      return expect(
        this.DocumentHelper.getTitleFromTexContent(document)
      ).to.equal('wombat')
    })

    // NICETOHAVE: Current implementation doesn't do this
    // it "should keep content that surrounds formatting elements", ->
    //	document = "\\title{Second Year \\large{LaTeX} Exercise}"
    //	expect(@DocumentHelper.getTitleFromTexContent(document)).to.equal "Second Year LaTeX Exercise"

    it('should collapse whitespace', function() {
      const document = '\\title{Second    Year  LaTeX     Exercise}'
      return expect(
        this.DocumentHelper.getTitleFromTexContent(document)
      ).to.equal('Second Year LaTeX Exercise')
    })
  })

  describe('detex', function() {
    // note, there are a number of tests for getTitleFromTexContent that also test cases here
    it('leaves a non-TeX string unchanged', function() {
      expect(this.DocumentHelper.detex('')).to.equal('')
      expect(this.DocumentHelper.detex('a')).to.equal('a')
      return expect(this.DocumentHelper.detex('a a')).to.equal('a a')
    })

    it('collapses spaces', function() {
      expect(this.DocumentHelper.detex('a  a')).to.equal('a a')
      return expect(this.DocumentHelper.detex('a \n a')).to.equal('a \n a')
    })

    it('replaces named commands', function() {
      expect(this.DocumentHelper.detex('\\LaTeX')).to.equal('LaTeX')
      expect(this.DocumentHelper.detex('\\TikZ')).to.equal('TikZ')
      expect(this.DocumentHelper.detex('\\TeX')).to.equal('TeX')
      return expect(this.DocumentHelper.detex('\\BibTeX')).to.equal('BibTeX')
    })

    it('removes general commands', function() {
      expect(this.DocumentHelper.detex('\\foo')).to.equal('')
      expect(this.DocumentHelper.detex('\\foo{}')).to.equal('')
      expect(this.DocumentHelper.detex('\\foo~Test')).to.equal('Test')
      expect(this.DocumentHelper.detex('\\"e')).to.equal('e')
      return expect(this.DocumentHelper.detex('\\textit{e}')).to.equal('e')
    })

    it('leaves basic math', function() {
      return expect(this.DocumentHelper.detex('$\\cal{O}(n^2)$')).to.equal(
        'O(n^2)'
      )
    })

    it('removes line spacing commands', function() {
      return expect(this.DocumentHelper.detex('a \\\\[1.50cm] b')).to.equal(
        'a b'
      )
    })
  })

  describe('contentHasDocumentclass', function() {
    it('should return true if the content has a documentclass', function() {
      const document = ['% line', '% line', '% line', '\\documentclass']
      return expect(
        this.DocumentHelper.contentHasDocumentclass(document)
      ).to.equal(true)
    })

    it('should allow whitespace before the documentclass', function() {
      const document = ['% line', '% line', '% line', '        \\documentclass']
      return expect(
        this.DocumentHelper.contentHasDocumentclass(document)
      ).to.equal(true)
    })

    it('should not allow non-whitespace before the documentclass', function() {
      const document = [
        '% line',
        '% line',
        '% line',
        '    asdf \\documentclass'
      ]
      return expect(
        this.DocumentHelper.contentHasDocumentclass(document)
      ).to.equal(false)
    })

    it('should return false when there is no documentclass', function() {
      const document = ['% line', '% line', '% line']
      return expect(
        this.DocumentHelper.contentHasDocumentclass(document)
      ).to.equal(false)
    })
  })
})

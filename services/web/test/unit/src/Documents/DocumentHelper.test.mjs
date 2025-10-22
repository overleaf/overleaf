import { expect } from 'vitest'
const modulePath = '../../../../app/src/Features/Documents/DocumentHelper.mjs'

describe('DocumentHelper', function () {
  beforeEach(async function (ctx) {
    ctx.DocumentHelper = (await import(modulePath)).default
  })

  describe('getTitleFromTexContent', function () {
    it('should return the title', function (ctx) {
      const document = '\\begin{document}\n\\title{foo}\n\\end{document}'
      expect(ctx.DocumentHelper.getTitleFromTexContent(document)).to.equal(
        'foo'
      )
    })

    it('should return the title if surrounded by space', function (ctx) {
      const document = '\\begin{document}\n   \\title{foo}   \n\\end{document}'
      expect(ctx.DocumentHelper.getTitleFromTexContent(document)).to.equal(
        'foo'
      )
    })

    it('should return null if there is no title', function (ctx) {
      const document = '\\begin{document}\n\\end{document}'
      expect(ctx.DocumentHelper.getTitleFromTexContent(document)).to.eql(null)
    })

    it('should accept an array', function (ctx) {
      const document = ['\\begin{document}', '\\title{foo}', '\\end{document}']
      expect(ctx.DocumentHelper.getTitleFromTexContent(document)).to.equal(
        'foo'
      )
    })

    it('should parse out formatting elements from the title', function (ctx) {
      const document = '\\title{\\textbf{\\large{Second Year LaTeX Exercise}}}'
      expect(ctx.DocumentHelper.getTitleFromTexContent(document)).to.equal(
        'Second Year LaTeX Exercise'
      )
    })

    it('should ignore junk after the title', function (ctx) {
      const document = '\\title{wombat} potato'
      expect(ctx.DocumentHelper.getTitleFromTexContent(document)).to.equal(
        'wombat'
      )
    })

    it('should ignore junk before the title', function (ctx) {
      const document =
        '% this is something that v1 relied on, even though it seems odd \\title{wombat}'
      expect(ctx.DocumentHelper.getTitleFromTexContent(document)).to.equal(
        'wombat'
      )
    })

    // NICETOHAVE: Current implementation doesn't do this
    // it "should keep content that surrounds formatting elements", ->
    //	document = "\\title{Second Year \\large{LaTeX} Exercise}"
    //	expect(@DocumentHelper.getTitleFromTexContent(document)).to.equal "Second Year LaTeX Exercise"

    it('should collapse whitespace', function (ctx) {
      const document = '\\title{Second    Year  LaTeX     Exercise}'
      expect(ctx.DocumentHelper.getTitleFromTexContent(document)).to.equal(
        'Second Year LaTeX Exercise'
      )
    })
  })

  describe('detex', function () {
    // note, there are a number of tests for getTitleFromTexContent that also test cases here
    it('leaves a non-TeX string unchanged', function (ctx) {
      expect(ctx.DocumentHelper.detex('')).to.equal('')
      expect(ctx.DocumentHelper.detex('a')).to.equal('a')
      expect(ctx.DocumentHelper.detex('a a')).to.equal('a a')
    })

    it('collapses spaces', function (ctx) {
      expect(ctx.DocumentHelper.detex('a  a')).to.equal('a a')
      expect(ctx.DocumentHelper.detex('a \n a')).to.equal('a \n a')
    })

    it('replaces named commands', function (ctx) {
      expect(ctx.DocumentHelper.detex('\\LaTeX')).to.equal('LaTeX')
      expect(ctx.DocumentHelper.detex('\\TikZ')).to.equal('TikZ')
      expect(ctx.DocumentHelper.detex('\\TeX')).to.equal('TeX')
      expect(ctx.DocumentHelper.detex('\\BibTeX')).to.equal('BibTeX')
    })

    it('removes general commands', function (ctx) {
      expect(ctx.DocumentHelper.detex('\\foo')).to.equal('')
      expect(ctx.DocumentHelper.detex('\\foo{}')).to.equal('')
      expect(ctx.DocumentHelper.detex('\\foo~Test')).to.equal('Test')
      expect(ctx.DocumentHelper.detex('\\"e')).to.equal('e')
      expect(ctx.DocumentHelper.detex('\\textit{e}')).to.equal('e')
    })

    it('leaves basic math', function (ctx) {
      expect(ctx.DocumentHelper.detex('$\\cal{O}(n^2)$')).to.equal('O(n^2)')
    })

    it('removes line spacing commands', function (ctx) {
      expect(ctx.DocumentHelper.detex('a \\\\[1.50cm] b')).to.equal('a b')
    })
  })

  describe('contentHasDocumentclass', function () {
    it('should return true if the content has a documentclass', function (ctx) {
      const document = ['% line', '% line', '% line', '\\documentclass']
      expect(ctx.DocumentHelper.contentHasDocumentclass(document)).to.equal(
        true
      )
    })

    it('should allow whitespace before the documentclass', function (ctx) {
      const document = ['% line', '% line', '% line', '        \\documentclass']
      expect(ctx.DocumentHelper.contentHasDocumentclass(document)).to.equal(
        true
      )
    })

    it('should not allow non-whitespace before the documentclass', function (ctx) {
      const document = [
        '% line',
        '% line',
        '% line',
        '    asdf \\documentclass',
      ]
      expect(ctx.DocumentHelper.contentHasDocumentclass(document)).to.equal(
        false
      )
    })

    it('should return false when there is no documentclass', function (ctx) {
      const document = ['% line', '% line', '% line']
      expect(ctx.DocumentHelper.contentHasDocumentclass(document)).to.equal(
        false
      )
    })
  })
})

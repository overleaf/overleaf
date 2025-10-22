import { beforeAll, describe, expect } from 'vitest'
import path from 'node:path'
const MODULE_PATH = path.join(
  import.meta.dirname,
  '../../../../app/src/Features/Helpers/SafeHTMLSubstitution.mjs'
)

describe('SafeHTMLSubstitution', function () {
  let SafeHTMLSubstitution
  beforeAll(async function () {
    SafeHTMLSubstitution = (await import(MODULE_PATH)).default
  })

  describe('SPLIT_REGEX', function () {
    const CASES = {
      'PRE<0>INNER</0>POST': ['PRE', '0', 'INNER', 'POST'],
      '<0>INNER</0>': ['', '0', 'INNER', ''],
      '<0></0>': ['', '0', '', ''],
      '<0>INNER</0><0>INNER2</0>': ['', '0', 'INNER', '', '0', 'INNER2', ''],
      '<0><1>INNER</1></0>': ['', '0', '<1>INNER</1>', ''],
      'PLAIN TEXT': ['PLAIN TEXT'],
    }
    Object.entries(CASES).forEach(([input, output]) => {
      it(`should parse "${input}" as expected`, function () {
        expect(input.split(SafeHTMLSubstitution.SPLIT_REGEX)).to.deep.equal(
          output
        )
      })
    })
  })

  describe('render', function () {
    describe('substitution', function () {
      it('should substitute a single component', function () {
        expect(
          SafeHTMLSubstitution.render('<0>good</0>', [{ name: 'b' }])
        ).to.equal('<b>good</b>')
      })

      it('should substitute a single component as string', function () {
        expect(SafeHTMLSubstitution.render('<0>good</0>', ['b'])).to.equal(
          '<b>good</b>'
        )
      })

      it('should substitute a single component twice', function () {
        expect(
          SafeHTMLSubstitution.render('<0>one</0><0>two</0>', [{ name: 'b' }])
        ).to.equal('<b>one</b><b>two</b>')
      })

      it('should substitute two components', function () {
        expect(
          SafeHTMLSubstitution.render('<0>one</0><1>two</1>', [
            { name: 'b' },
            { name: 'i' },
          ])
        ).to.equal('<b>one</b><i>two</i>')
      })

      it('should substitute a single component with a class', function () {
        expect(
          SafeHTMLSubstitution.render('<0>text</0>', [
            {
              name: 'b',
              attrs: {
                class: 'magic',
              },
            },
          ])
        ).to.equal('<b class="magic">text</b>')
      })

      it('should substitute two nested components', function () {
        expect(
          SafeHTMLSubstitution.render('<0><1>nested</1></0>', [
            { name: 'b' },
            { name: 'i' },
          ])
        ).to.equal('<b><i>nested</i></b>')
      })

      it('should handle links', function () {
        expect(
          SafeHTMLSubstitution.render('<0>Go to Login</0>', [
            { name: 'a', attrs: { href: 'https://www.overleaf.com/login' } },
          ])
        ).to.equal('<a href="https://www.overleaf.com/login">Go to Login</a>')
      })

      it('should not complain about too many components', function () {
        expect(
          SafeHTMLSubstitution.render('<0>good</0>', [
            { name: 'b' },
            { name: 'i' },
            { name: 'u' },
          ])
        ).to.equal('<b>good</b>')
      })
    })

    describe('pug.escape', function () {
      it('should handle plain text', function () {
        expect(SafeHTMLSubstitution.render('plain text')).to.equal('plain text')
      })

      it('should keep a simple string delimiter', function () {
        expect(SafeHTMLSubstitution.render("'")).to.equal(`'`)
      })

      it('should escape double quotes', function () {
        expect(SafeHTMLSubstitution.render('"')).to.equal(`&quot;`)
      })

      it('should escape &', function () {
        expect(SafeHTMLSubstitution.render('&')).to.equal(`&amp;`)
      })

      it('should escape <', function () {
        expect(SafeHTMLSubstitution.render('<')).to.equal(`&lt;`)
      })

      it('should escape >', function () {
        expect(SafeHTMLSubstitution.render('>')).to.equal(`&gt;`)
      })

      it('should escape html', function () {
        expect(SafeHTMLSubstitution.render('<b>bad</b>')).to.equal(
          '&lt;b&gt;bad&lt;/b&gt;'
        )
      })
    })

    describe('escape around substitutions', function () {
      it('should escape text inside a component', function () {
        expect(
          SafeHTMLSubstitution.render('<0><i>inner</i></0>', [{ name: 'b' }])
        ).to.equal('<b>&lt;i&gt;inner&lt;/i&gt;</b>')
      })

      it('should escape text in front of a component', function () {
        expect(
          SafeHTMLSubstitution.render('<i>PRE</i><0>inner</0>', [{ name: 'b' }])
        ).to.equal('&lt;i&gt;PRE&lt;/i&gt;<b>inner</b>')
      })

      it('should escape text after of a component', function () {
        expect(
          SafeHTMLSubstitution.render('<0>inner</0><i>POST</i>', [
            { name: 'b' },
          ])
        ).to.equal('<b>inner</b>&lt;i&gt;POST&lt;/i&gt;')
      })
    })
  })
})

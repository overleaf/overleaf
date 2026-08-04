import { expect } from 'chai'
import {
  findDefinition,
  parseDefinitionsFromDoc,
} from '../../../../../../frontend/js/features/source-editor/utils/command-definitions/command-definition'

describe('command-definition', function () {
  describe('parseDefinitionsFromDoc', function () {
    it('indexes \\newcommand definitions at their offset', function () {
      const content = 'line one\n\\newcommand{\\foo}{bar}\n'
      const defs = parseDefinitionsFromDoc('macros.tex', content)
      expect(defs).to.have.length(1)
      expect(defs[0]).to.include({
        name: '\\foo',
        path: 'macros.tex',
        pos: content.indexOf('\\newcommand'),
      })
    })

    it('indexes \\def and \\let definitions', function () {
      const content = '\\def\\bar#1{#1}\n\\let\\baz\\bar\n'
      const names = parseDefinitionsFromDoc('defs.tex', content).map(
        d => d.name
      )
      expect(names).to.include('\\bar')
      expect(names).to.include('\\baz')
    })

    it('ignores commented-out definitions', function () {
      const content =
        '% \\newcommand{\\ignored}{nope}\n\\newcommand{\\real}{x}\n'
      const names = parseDefinitionsFromDoc('main.tex', content).map(
        d => d.name
      )
      expect(names).to.include('\\real')
      expect(names).not.to.include('\\ignored')
    })
  })

  describe('findDefinition', function () {
    it('finds the defining document for a command', function () {
      const docs = [
        { path: 'macros.tex', content: '\\newcommand{\\foo}{x}\n' },
        { path: 'chapters/intro.tex', content: '\\def\\bar{y}\n' },
      ]
      expect(findDefinition(docs, '\\foo')?.path).to.equal('macros.tex')
      expect(findDefinition(docs, '\\bar')?.path).to.equal('chapters/intro.tex')
    })

    it('returns null when the command is not defined', function () {
      const docs = [{ path: 'macros.tex', content: '\\newcommand{\\foo}{x}\n' }]
      expect(findDefinition(docs, '\\missing')).to.equal(null)
    })

    it('returns the first definition across documents', function () {
      const docs = [
        { path: 'a.tex', content: '\\newcommand{\\dup}{1}\n' },
        { path: 'b.tex', content: '\\renewcommand{\\dup}{2}\n' },
      ]
      expect(findDefinition(docs, '\\dup')?.path).to.equal('a.tex')
    })
  })
})

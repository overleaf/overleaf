import { LanguageSupport } from '@codemirror/language'
import { EditorState } from '@codemirror/state'
import { expect } from 'chai'
import { commandNameAtPos } from '@/features/source-editor/utils/command-definitions/command-name-at-pos'
import { LaTeXLanguage } from '@/features/source-editor/languages/latex/latex-language'

const latex = new LanguageSupport(LaTeXLanguage)

const makeState = (doc: string): EditorState =>
  EditorState.create({ doc, extensions: [latex] })

describe('commandNameAtPos', function () {
  it('resolves the command name when the position is on the command', function () {
    const doc = 'before \\mycmd{arg} after'
    const state = makeState(doc)
    const from = doc.indexOf('\\mycmd')
    expect(commandNameAtPos(state, from)).to.equal('\\mycmd')
    expect(commandNameAtPos(state, from + 3)).to.equal('\\mycmd')
  })

  it('resolves a known command name', function () {
    const doc = 'some \\textbf{bold} text'
    const state = makeState(doc)
    expect(commandNameAtPos(state, doc.indexOf('\\textbf'))).to.equal(
      '\\textbf'
    )
  })

  it('returns null for a control symbol', function () {
    const doc = 'linebreak \\\\ and \\% percent'
    const state = makeState(doc)
    expect(commandNameAtPos(state, doc.indexOf('\\\\'))).to.equal(null)
    expect(commandNameAtPos(state, doc.indexOf('\\%'))).to.equal(null)
  })

  it('returns null on plain text', function () {
    const doc = 'plain text \\mycmd{arg}'
    const state = makeState(doc)
    expect(commandNameAtPos(state, 0)).to.equal(null)
  })

  it("returns null inside a command's argument", function () {
    const doc = '\\mycmd{argument}'
    const state = makeState(doc)
    expect(commandNameAtPos(state, doc.indexOf('argument') + 3)).to.equal(null)
  })
})

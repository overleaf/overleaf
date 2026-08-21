import { expect } from 'chai'
import { EditorState } from '@codemirror/state'
import { LaTeXLanguage } from '@/features/source-editor/languages/latex/latex-language'
import { LanguageSupport, ensureSyntaxTree } from '@codemirror/language'
import { findAssistantTarget } from '@modules/workbench/frontend/js/codemirror/assistant-pointer-detection'

const makeState = (doc: string, anchor: number, head?: number) => {
  const state = EditorState.create({
    doc,
    selection: { anchor, head },
    extensions: [new LanguageSupport(LaTeXLanguage)],
  })
  ensureSyntaxTree(state, doc.length, 1000)
  return state
}

describe('findAssistantTarget', function () {
  it('finds a table environment around the cursor', function () {
    const doc = '\\begin{table}\n  x\n\\end{table}\n'
    const result = findAssistantTarget(makeState(doc, doc.indexOf('x')))
    expect(result).to.include({
      kind: 'environment',
      from: 0,
      to: doc.indexOf('\\end{table}') + '\\end{table}'.length,
    })
    expect(result?.names).to.deep.equal(['table'])
    expect(result?.line.from).to.equal(0)
  })

  it('returns null outside any environment', function () {
    const doc = 'text\n\\begin{table}\n\\end{table}\n'
    expect(findAssistantTarget(makeState(doc, 2))).to.be.null
  })

  it('returns null inside an irrelevant environment', function () {
    const doc = '\\begin{quote}\n  x\n\\end{quote}\n'
    expect(findAssistantTarget(makeState(doc, doc.indexOf('x')))).to.be.null
  })

  it('finds a list environment around the cursor', function () {
    const doc = '\\begin{itemize}\n  \\item x\n\\end{itemize}\n'
    const result = findAssistantTarget(makeState(doc, doc.indexOf('item')))
    expect(result?.names).to.deep.equal(['itemize'])
  })

  it('finds the innermost relevant environment when nested', function () {
    const doc =
      '\\begin{figure}\n\\begin{tabular}{c}\nx\n\\end{tabular}\n\\end{figure}\n'
    const result = findAssistantTarget(makeState(doc, doc.indexOf('x\n')))
    expect(result?.names).to.deep.equal(['tabular'])
  })

  it('finds a starred environment', function () {
    const doc = '\\begin{align*}\nx\n\\end{align*}\n'
    const result = findAssistantTarget(makeState(doc, doc.indexOf('x')))
    expect(result?.names).to.deep.equal(['align*'])
  })

  it('finds a usepackage command around the cursor', function () {
    const doc = 'text\n\\usepackage[draft]{graphicx}\n'
    const result = findAssistantTarget(
      makeState(doc, doc.indexOf('graphicx') + 2)
    )
    expect(result).to.include({
      kind: 'package',
      from: doc.indexOf('\\usepackage'),
      to: doc.indexOf('graphicx}') + 'graphicx}'.length,
    })
    expect(result?.names).to.deep.equal(['graphicx'])
    expect(result?.line.from).to.equal(5)
  })

  it('parses a comma-separated package list', function () {
    const doc = '\\usepackage{amsmath, amssymb}\n'
    const result = findAssistantTarget(makeState(doc, doc.indexOf('amssymb')))
    expect(result?.names).to.deep.equal(['amsmath', 'amssymb'])
  })

  it('matches a selection spanning the whole environment', function () {
    const doc = 'a\n\\begin{table}\nx\n\\end{table}\nb\n'
    const from = doc.indexOf('\\begin')
    const to = doc.indexOf('b\n', from) - 1
    const result = findAssistantTarget(makeState(doc, from, to))
    expect(result?.names).to.deep.equal(['table'])
  })

  it('matches a selection starting directly before the environment and ending inside', function () {
    const doc = 'a\n\\begin{table}\nx\n\\end{table}\nb\n'
    const from = doc.indexOf('\\begin')
    const result = findAssistantTarget(
      makeState(doc, from, doc.indexOf('x') + 1)
    )
    expect(result?.names).to.deep.equal(['table'])
  })

  it('does not match a selection extending beyond the environment', function () {
    const doc = 'a\n\\begin{table}\nx\n\\end{table}\nb\n'
    const result = findAssistantTarget(
      makeState(doc, doc.indexOf('x'), doc.length)
    )
    expect(result).to.be.null
  })
})

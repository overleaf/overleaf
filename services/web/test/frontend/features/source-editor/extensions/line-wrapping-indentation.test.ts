import { expect } from 'chai'
import { EditorView, DecorationSet } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { buildDecorations } from '../../../../../frontend/js/features/source-editor/extensions/line-wrapping-indentation'

const basicDoc = `
\\begin{document}
Test
\\end{document}
`

const docLongLineNoIndentation = `
\\begin{document}
Test
Hello one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four
\\end{document}
`

const docLongLineWithIndentation = `
\\begin{document}
Test
  Hello one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four
\\end{document}
`

const docLongLineWithLotsOfIndentation = `
\\begin{document}
Test
  Hello one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four

  Hello one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four

    Hello one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four

Hello

  Hello one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four  one two three four one two three four

Hello
\\end{document}
`

describe('line-wrapping-indentation', function () {
  describe('buildDecorations', function () {
    const _buildView = (doc: string) => {
      return new EditorView({
        state: EditorState.create({
          doc,
        }),
      })
    }

    const _toArray = (decorations: DecorationSet) => {
      const result = []
      const cursor = decorations.iter()
      while (cursor.value) {
        result.push({ from: cursor.from, to: cursor.to, value: cursor.value })
        cursor.next()
      }
      return result
    }

    describe('basic document', function () {
      it('should have no decorations', function () {
        const view = _buildView(basicDoc)

        const decorations = buildDecorations(view, 24)
        expect(decorations).to.exist
        expect(decorations.size).to.equal(0)
      })
    })

    describe('document with long lines, no indentation', function () {
      it('should have no decorations', function () {
        const view = _buildView(docLongLineNoIndentation)

        const decorations = buildDecorations(view, 24)
        expect(decorations).to.exist
        expect(decorations.size).to.equal(0)
      })
    })

    describe('document with long lines, with indentation', function () {
      it('should have a decoration', function () {
        const view = _buildView(docLongLineWithIndentation)

        const decorations = buildDecorations(view, 24)
        expect(decorations).to.exist
        expect(decorations.size).to.equal(1)

        const decorationItem = _toArray(decorations)[0]
        expect(decorationItem.from).to.equal(23)
        expect(decorationItem.to).to.equal(23)
      })
    })

    describe('document with long lines, with lots of indentation', function () {
      it('should have a decoration', function () {
        const view = _buildView(docLongLineWithLotsOfIndentation)

        const decorations = buildDecorations(view, 24)
        expect(decorations).to.exist
        expect(decorations.size).to.equal(4)

        const decorationsArray = _toArray(decorations)
        const expectedPositions = [23, 265, 507, 758]

        decorationsArray.forEach((item, index) => {
          expect(item.from).to.equal(expectedPositions[index])
          expect(item.to).to.equal(expectedPositions[index])
        })
      })
    })
  })
})

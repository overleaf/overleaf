import { expect } from 'chai'
import { EditorState, EditorSelection } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import {
  copySelection,
  cutSelection,
  pasteWithoutFormatting,
  pasteWithFormatting,
} from '../../../../../frontend/js/features/source-editor/commands/clipboard'

const createClipboardStub = () => {
  const stub = {
    written: null as string | null,
    reads: [] as string[],
    rejectRead: undefined as Error | undefined,
    writeText: async (text: string) => {
      stub.written = text
    },
    readText: async () => {
      if (stub.rejectRead) throw stub.rejectRead
      return stub.reads.shift() ?? ''
    },
  }
  return stub
}

const createView = (doc: string, anchor = 0, head = anchor) => {
  const state = EditorState.create({ doc, selection: { anchor, head } })
  const parent = document.createElement('div')
  return new EditorView({ state, parent })
}

const createViewWithMultipleRanges = (
  doc: string,
  ranges: Array<{ anchor: number; head?: number }>
) => {
  const state = EditorState.create({
    doc,
    extensions: [EditorState.allowMultipleSelections.of(true)],
    selection: EditorSelection.create(
      ranges.map(({ anchor, head }) =>
        EditorSelection.range(anchor, head ?? anchor)
      )
    ),
  })
  const parent = document.createElement('div')
  return new EditorView({ state, parent })
}

describe('clipboard behavior', function () {
  let clipboard: ReturnType<typeof createClipboardStub>

  beforeEach(function () {
    clipboard = createClipboardStub()
    ;(navigator as any).clipboard = clipboard
  })

  describe('copySelection', function () {
    it('copies only the selected range when a selection exists', async function () {
      const view = createView('abcde', 1, 4) // selects "bcd"
      await copySelection(view)
      expect(clipboard.written).to.equal('bcd')
    })

    it('copies entire current line with trailing break when no selection (middle line)', async function () {
      const view = createView('one\ntwo\nthree', 5) // inside "two"
      await copySelection(view)
      expect(clipboard.written).to.equal('two\n')
    })

    it('copies last line without an extra trailing break at document end', async function () {
      const view = createView('one\ntwo\nthree', 9) // inside "three"
      await copySelection(view)
      expect(clipboard.written).to.equal('three')
    })

    it('copies all selected ranges when multiple selections exist', async function () {
      const view = createViewWithMultipleRanges('abcdefgh', [
        { anchor: 0, head: 1 }, // "a"
        { anchor: 3, head: 5 }, // "de"
      ])
      await copySelection(view)
      expect(clipboard.written).to.equal('ade')
    })

    it('copies entire lines for each cursor when multiple empty selections', async function () {
      const view = createViewWithMultipleRanges('line1\nline2\nline3', [
        { anchor: 2 }, // in "line1"
        { anchor: 8 }, // in "line2"
      ])
      await copySelection(view)
      expect(clipboard.written).to.equal('line1\nline2\n')
    })
  })

  describe('cutSelection', function () {
    it('cuts only the selected range when a selection exists', async function () {
      const view = createView('abcde', 1, 4) // selects "bcd"
      await cutSelection(view)
      expect(clipboard.written).to.equal('bcd')
      expect(view.state.doc.toString()).to.equal('ae')
    })

    it('cuts entire line with trailing break when no selection (middle line)', async function () {
      const view = createView('first\nsecond', 1)
      await cutSelection(view)
      expect(clipboard.written).to.equal('first\n')
      expect(view.state.doc.toString()).to.equal('second')
    })

    it('cuts last line without removing the preceding newline when at document end', async function () {
      const view = createView('first\nsecond', 8) // inside last line
      await cutSelection(view)
      expect(clipboard.written).to.equal('second')
      expect(view.state.doc.toString()).to.equal('first\n')
    })

    it('cuts all selected ranges when multiple selections exist', async function () {
      const view = createViewWithMultipleRanges('abcdefgh', [
        { anchor: 0, head: 2 }, // "ab"
        { anchor: 4, head: 6 }, // "ef"
      ])
      await cutSelection(view)
      expect(clipboard.written).to.equal('abef')
      expect(view.state.doc.toString()).to.equal('cdgh')
    })

    it('cuts entire lines for each cursor when multiple empty selections', async function () {
      const view = createViewWithMultipleRanges('line1\nline2\nline3', [
        { anchor: 2 }, // in "line1"
        { anchor: 14 }, // in "line3"
      ])
      await cutSelection(view)
      expect(clipboard.written).to.equal('line1\nline3')
      expect(view.state.doc.toString()).to.equal('line2\n')
    })
  })

  describe('pasteWithoutFormatting', function () {
    it('inserts a line-wise single line above current line when no selection', async function () {
      clipboard.reads.push('pasted\n')
      const view = createView('current', 0)
      await pasteWithoutFormatting(view)
      expect(view.state.doc.toString()).to.equal('pasted\ncurrent')
    })

    it('replaces an existing selection inline with single-line text', async function () {
      clipboard.reads.push('XX')
      const view = createView('hello', 1, 3) // replace "el"
      await pasteWithoutFormatting(view)
      expect(view.state.doc.toString()).to.equal('hXXlo')
    })

    it('replaces an existing selection even when clipboard text is line-wise (no insert-above)', async function () {
      clipboard.reads.push('line\n')
      const view = createView('abc', 0, 1) // replace "a"
      await pasteWithoutFormatting(view)
      expect(view.state.doc.toString()).to.equal('line\nbc')
    })

    it('pastes multiline text inline (no line-wise handling)', async function () {
      clipboard.reads.push('lineA\nlineB\n')
      const view = createView('X', 0)
      await pasteWithoutFormatting(view)
      expect(view.state.doc.toString()).to.equal('lineA\nlineB\nX')
    })

    it('returns false and leaves document unchanged if clipboard read fails', async function () {
      clipboard.rejectRead = new Error('denied')
      const view = createView('stay', 0)
      const result = await pasteWithoutFormatting(view)
      expect(result).to.equal(false)
      expect(view.state.doc.toString()).to.equal('stay')
    })

    it('pastes into all selected ranges when multiple selections exist', async function () {
      clipboard.reads.push('XX')
      const view = createViewWithMultipleRanges('abcdefgh', [
        { anchor: 1, head: 2 }, // "b"
        { anchor: 5, head: 6 }, // "f"
      ])
      await pasteWithoutFormatting(view)
      expect(view.state.doc.toString()).to.equal('aXXcdeXXgh')
    })

    it('pastes line-wise content at line start for each cursor when multiple empty selections', async function () {
      clipboard.reads.push('new\n')
      const view = createViewWithMultipleRanges('line1\nline2', [
        { anchor: 2 }, // in "line1"
        { anchor: 8 }, // in "line2"
      ])
      await pasteWithoutFormatting(view)
      expect(view.state.doc.toString()).to.equal('new\nline1\nnew\nline2')
    })

    it('preserves multiple cursors after pasting into multiple selections', async function () {
      clipboard.reads.push('XX')
      const view = createViewWithMultipleRanges('abcdefgh', [
        { anchor: 1, head: 2 }, // "b"
        { anchor: 5, head: 6 }, // "f"
      ])
      await pasteWithoutFormatting(view)
      const ranges = view.state.selection.ranges
      expect(ranges).to.have.length(2)
      expect(ranges.every(r => r.empty)).to.equal(true)
    })

    it('preserves multiple cursors when pasting line-wise content', async function () {
      clipboard.reads.push('new\n')
      const view = createViewWithMultipleRanges('line1\nline2', [
        { anchor: 2 }, // in "line1"
        { anchor: 8 }, // in "line2"
      ])
      await pasteWithoutFormatting(view)
      // After line-wise paste at line starts: cursor should be after each "new\n"
      const ranges = view.state.selection.ranges
      expect(ranges).to.have.length(2)
      expect(ranges[0].anchor).to.equal(4) // after first "new\n"
      expect(ranges[1].anchor).to.equal(14) // after second "new\n" (original pos 8 + 4 from first insert + 4 from second)
    })
  })

  describe('pasteWithFormatting', function () {
    // Helper to set clipboard.read with HTML + plain text
    const setClipboardHtml = (html: string, text: string) => {
      ;(navigator as any).clipboard.read = async () => [
        {
          types: ['text/html', 'text/plain'],
          // Avoid relying on DOM Blob in the Mocha/jsdom environment.
          getType: async (type: string) =>
            ({
              text: async () => (type === 'text/html' ? html : text),
            }) as any,
        },
      ]
      ;(navigator as any).clipboard.readText = async () => text
    }

    it('pastes converted HTML into a single selection', async function () {
      setClipboardHtml('<b>x</b>', 'x')
      const view = createView('abcde', 2, 3) // replace 'c'
      await pasteWithFormatting(view)
      expect(view.state.doc.toString()).to.equal('ab\\textbf{x}de')
      expect(view.state.selection.ranges).to.have.length(1)
      expect(view.state.selection.main.empty).to.equal(true)
    })

    it('pastes converted HTML into all selected ranges (multi-range)', async function () {
      setClipboardHtml('<strong>x</strong>', 'x')
      const view = createViewWithMultipleRanges('abcdefgh', [
        { anchor: 1, head: 2 }, // b
        { anchor: 5, head: 6 }, // f
      ])
      await pasteWithFormatting(view)
      expect(view.state.doc.toString()).to.equal('a\\textbf{x}cde\\textbf{x}gh')
      expect(view.state.selection.ranges).to.have.length(2)
      expect(view.state.selection.ranges.every(r => r.empty)).to.equal(true)
    })

    it('falls back to plain text when there is no formatting', async function () {
      setClipboardHtml('x', 'x')
      const view = createViewWithMultipleRanges('abcdefgh', [
        { anchor: 1, head: 2 },
        { anchor: 5, head: 6 },
      ])
      await pasteWithFormatting(view)
      expect(view.state.doc.toString()).to.equal('axcdexgh')
      expect(view.state.selection.ranges).to.have.length(2)
    })
  })
})

import { expect } from 'chai'
import { EditorState } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { compositionSync } from '../../../../../frontend/js/features/source-editor/extensions/composition'

const nextFrame = () =>
  new Promise<void>(resolve => requestAnimationFrame(() => resolve()))

// Integration tests that drive the compositionSync extension with synthetic
// composition events. Real IME composition can't be simulated in jsdom, but the
// extension's reconcile is triggered by compositionstart/compositionend DOM
// events plus a small stub of DocumentContainer, which we can drive here. This
// notably covers the remote-edit-during-composition path, which can't be tested
// manually by a single user (switching focus commits the composition).
describe('compositionSync', function () {
  const setup = (snapshot: string, initialDoc = snapshot) => {
    const cm6 = { remoteOpDuringComposition: false }
    const currentDoc = {
      doc: {},
      cm6,
      getSnapshot: () => snapshot,
    }
    const state = EditorState.create({
      doc: initialDoc,
      extensions: [compositionSync(currentDoc as any)],
    })
    const view = new EditorView({ state })
    return { view, cm6 }
  }

  // Simulate composing `text` at the end of the document, optionally running
  // `onComposing` (e.g. to flag a remote edit) before the composition ends.
  const compose = async (
    view: EditorView,
    text: string,
    onComposing?: () => void
  ) => {
    view.contentDOM.dispatchEvent(new Event('compositionstart'))
    // Insert the composed text and place the caret after it, as an IME does.
    const at = view.state.doc.length
    view.dispatch({
      changes: { from: at, insert: text },
      selection: { anchor: at + text.length },
    })
    onComposing?.()
    view.contentDOM.dispatchEvent(new Event('compositionend'))
    await nextFrame()
    await nextFrame()
  }

  it('commits a composed emoji as a single replacement char with the caret after it', async function () {
    const { view } = setup('abc')
    await compose(view, '\u{1F600}')
    expect(view.state.doc.toString()).to.equal('abc�')
    expect(view.state.selection.main.head).to.equal(4)
    view.destroy()
  })

  it('commits normal composed text unchanged', async function () {
    const { view } = setup('abc')
    await compose(view, 'にほんご')
    expect(view.state.doc.toString()).to.equal('abcにほんご')
    expect(view.state.selection.main.head).to.equal('abcにほんご'.length)
    view.destroy()
  })

  it('discards the composition and resyncs to the snapshot when a remote edit arrives mid-composition', async function () {
    // The snapshot advanced to 'Xabc' (a collaborator inserted 'X') while the
    // user was composing 'YZ' on top of the original 'abc'.
    const { view, cm6 } = setup('Xabc', 'abc')

    let toast: { key?: string; text?: string } | null = null
    const listener = (event: Event) => {
      toast = (event as CustomEvent).detail
    }
    window.addEventListener('ide:show-toast', listener)

    await compose(view, 'YZ', () => {
      cm6.remoteOpDuringComposition = true
    })

    window.removeEventListener('ide:show-toast', listener)

    expect(view.state.doc.toString()).to.equal('Xabc')
    expect(cm6.remoteOpDuringComposition).to.equal(false)
    expect(toast).to.not.equal(null)
    expect(toast!.key).to.equal('composition:discarded')
    expect(toast!.text).to.equal('YZ')
    view.destroy()
  })
})

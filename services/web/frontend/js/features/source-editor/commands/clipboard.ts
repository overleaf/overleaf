import { EditorView } from '@codemirror/view'
import {
  findImageInClipboard,
  dispatchFigureModalPasteEvent,
} from '../utils/paste-image'

const getEntireLineText = (view: EditorView, pos: number): string => {
  const line = view.state.doc.lineAt(pos)
  const atDocumentEnd = line.to === view.state.doc.length
  return atDocumentEnd ? line.text : line.text + view.state.lineBreak
}

export const cutSelection = async (view: EditorView): Promise<boolean> => {
  const selections = view.state.selection.ranges
  const changes = []
  const texts = []

  for (const range of selections) {
    const { from, to } = range
    if (from === to) {
      const text = getEntireLineText(view, from)
      texts.push(text)
      const line = view.state.doc.lineAt(from)
      const atDocumentEnd = line.to === view.state.doc.length
      const deleteTo = atDocumentEnd
        ? line.to
        : line.to + view.state.lineBreak.length
      changes.push({ from: line.from, to: deleteTo, insert: '' })
    } else {
      const text = view.state.sliceDoc(from, to)
      texts.push(text)
      changes.push({ from, to, insert: '' })
    }
  }

  await navigator.clipboard.writeText(texts.join(''))
  view.dispatch({
    changes,
    selection: { anchor: changes[0]?.from ?? view.state.selection.main.from },
  })
  return true
}

export const copySelection = async (view: EditorView): Promise<boolean> => {
  const selections = view.state.selection.ranges
  const texts = []

  for (const range of selections) {
    const { from, to } = range
    const text =
      from === to
        ? getEntireLineText(view, from)
        : view.state.sliceDoc(from, to)
    texts.push(text)
  }

  await navigator.clipboard.writeText(texts.join(''))
  return true
}

export const pasteWithoutFormatting = async (
  view: EditorView
): Promise<boolean> => {
  // Check for pasted images first
  const imageFile = await findImageInClipboard()
  if (imageFile) {
    dispatchFigureModalPasteEvent({
      name: imageFile.name,
      type: imageFile.type,
      data: imageFile,
    })
    return true
  }

  // Fall back to plain text paste
  try {
    const text = await navigator.clipboard.readText()
    const selections = view.state.selection.ranges
    const changes = []
    let lastChangeTo = 0

    // Detect line-wise paste: single line of text with trailing linebreak
    const textWithoutTrailingBreak = text.slice(0, -view.state.lineBreak.length)
    const isSingleLineWithTrailingBreak =
      text.endsWith(view.state.lineBreak) &&
      !textWithoutTrailingBreak.includes(view.state.lineBreak)

    // Apply paste to each selection/range
    for (const range of selections) {
      const { from, to } = range
      const noSelection = from === to
      const shouldInsertAtLineStart =
        noSelection && isSingleLineWithTrailingBreak

      if (shouldInsertAtLineStart) {
        const line = view.state.doc.lineAt(from)
        changes.push({ from: line.from, to: line.from, insert: text })
        lastChangeTo = line.from + text.length
      } else {
        changes.push({ from, to, insert: text })
        lastChangeTo = from + text.length
      }
    }

    view.dispatch({
      changes,
      selection: { anchor: lastChangeTo },
    })

    return true
  } catch {
    // Clipboard access denied or empty
    return false
  }
}

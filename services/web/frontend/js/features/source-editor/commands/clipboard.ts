import { EditorView } from '@codemirror/view'
import { EditorSelection } from '@codemirror/state'
import { handleImagePaste } from '../utils/paste-image'
import { convertHtmlStringToLatex } from '../extensions/visual/paste-html'
import {
  insertPastedContent,
  storePastedContent,
} from '../extensions/visual/pasted-content'

const getEntireLineText = (view: EditorView, pos: number): string => {
  const line = view.state.doc.lineAt(pos)
  const atDocumentEnd = line.to === view.state.doc.length
  return atDocumentEnd ? line.text : line.text + view.state.lineBreak
}

const pastePlainText = (view: EditorView, text: string): void => {
  // Detect line-wise paste: single line of text with trailing linebreak
  const textWithoutTrailingBreak = text.slice(0, -view.state.lineBreak.length)
  const isLineWise =
    text.endsWith(view.state.lineBreak) &&
    !textWithoutTrailingBreak.includes(view.state.lineBreak)

  // Use changeByRange to apply paste to each selection/range
  const changes = view.state.changeByRange(range => {
    const { from, to } = range
    const noSelection = from === to
    const shouldInsertAtLineStart = noSelection && isLineWise

    if (shouldInsertAtLineStart) {
      const line = view.state.doc.lineAt(from)
      return {
        changes: { from: line.from, to: line.from, insert: text },
        range: EditorSelection.cursor(line.from + text.length),
      }
    }

    return {
      changes: { from, to, insert: text },
      range: EditorSelection.cursor(from + text.length),
    }
  })

  view.dispatch(changes)
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
  if (await handleImagePaste()) {
    return true
  }

  // Fall back to plain text paste
  try {
    const text = await navigator.clipboard.readText()
    pastePlainText(view, text)
    return true
  } catch {
    // Clipboard access denied or empty
    return false
  }
}

export const pasteWithFormatting = async (
  view: EditorView
): Promise<boolean> => {
  try {
    const clipboardItems = await navigator.clipboard.read()

    let html = ''
    let text = ''
    let nonTextBlobCount = 0
    for (const item of clipboardItems) {
      for (const type of item.types) {
        const blob = await item.getType(type)
        if (type === 'text/html') {
          html = (await blob.text()).trim()
        } else if (type === 'text/plain') {
          text = (await blob.text()).trim()
        } else if (!type.startsWith('text/')) {
          nonTextBlobCount++
        }
      }
    }

    if (!html) {
      return await pasteWithoutFormatting(view)
    }

    const latex = convertHtmlStringToLatex(html, nonTextBlobCount)

    if (latex === null || (latex === text && nonTextBlobCount === 0)) {
      // No latex or formatting detected, use plain text paste
      return await pasteWithoutFormatting(view)
    }

    view.dispatch(insertPastedContent(view, { latex, text }))
    view.dispatch(storePastedContent({ latex, text }, true))
    return true
  } catch {
    // Clipboard.read not available, or latex conversion failed, use standard paste behavior
    return await pasteWithoutFormatting(view)
  }
}

import {
  bracketMatching as bracketMatchingExtension,
  matchBrackets,
  type MatchResult,
} from '@codemirror/language'
import { Decoration, EditorView } from '@codemirror/view'
import {
  EditorSelection,
  Extension,
  SelectionRange,
  type Range,
} from '@codemirror/state'
import browser from '@/features/source-editor/extensions/browser'

const matchingMark = Decoration.mark({ class: 'cm-matchingBracket' })
const nonmatchingMark = Decoration.mark({ class: 'cm-nonmatchingBracket' })

const FORWARDS = 1
const BACKWARDS = -1
type Direction = 1 | -1

/**
 * A built-in extension which decorates matching pairs of brackets when focused,
 * configured with a custom render function that combines adjacent pairs of matching markers
 * into a single decoration so there’s no border between them.
 */
export const bracketMatching = () => {
  return bracketMatchingExtension({
    renderMatch: match => {
      const decorations: Range<Decoration>[] = []

      if (matchedAdjacent(match)) {
        // combine an adjacent pair of matching markers into a single decoration
        decorations.push(
          matchingMark.range(
            Math.min(match.start.from, match.end.from),
            Math.max(match.start.to, match.end.to)
          )
        )
      } else {
        // default match rendering (defaultRenderMatch in @codemirror/matchbrackets)
        const mark = match.matched ? matchingMark : nonmatchingMark
        decorations.push(mark.range(match.start.from, match.start.to))
        if (match.end) {
          decorations.push(mark.range(match.end.from, match.end.to))
        }
      }

      return decorations
    },
  })
}

interface AdjacentMatchResult extends MatchResult {
  end: {
    from: number
    to: number
  }
}

const matchedAdjacent = (match: MatchResult): match is AdjacentMatchResult =>
  Boolean(
    match.matched &&
    match.end &&
    (match.start.to === match.end.from || match.end.to === match.start.from)
  )

/**
 * A custom extension which handles double-click events on a matched bracket
 * and extends the selection to cover the contents of the bracket pair.
 */
export const bracketSelection = (): Extension => {
  return [chooseEventHandler(), matchingBracketTheme]
}

const chooseEventHandler = () => {
  // Safari doesn't always fire the second "click" event, so use dblclick instead
  if (browser.safari) {
    return [
      EditorView.domEventHandlers({
        dblclick: handleDoubleClick,
      }),
    ]
  }

  // Store and use the previous click event, as the "dblclick" event can have the wrong position
  let lastClickEvent: MouseEvent | null = null

  return EditorView.domEventHandlers({
    click(evt, view) {
      if (evt.detail === 1) {
        lastClickEvent = evt
      } else if (evt.detail === 2 && lastClickEvent) {
        return handleDoubleClick(lastClickEvent, view)
      }
    },
  })
}

const handleDoubleClick = (evt: MouseEvent, view: EditorView) => {
  const pos = view.posAtCoords({
    x: evt.pageX,
    y: evt.pageY,
  })
  if (!pos) return false

  const search = (direction: Direction, position: number) => {
    const match = matchBrackets(view.state, position, direction, {
      // Only look at data in the syntax tree, don't scan the text
      maxScanDistance: 0,
    })
    if (match?.matched && match.end) {
      return EditorSelection.range(
        Math.min(match.start.from, match.end.from),
        Math.max(match.end.to, match.start.to)
      )
    }
    return false
  }

  const dispatchSelection = (range: SelectionRange) => {
    view.dispatch({
      selection: range,
    })
    return true
  }
  // 1. Look forwards, from the character *behind* the cursor
  const forwardsExcludingBrackets = search(FORWARDS, pos - 1)
  if (forwardsExcludingBrackets) {
    return dispatchSelection(
      EditorSelection.range(
        forwardsExcludingBrackets.from + 1,
        forwardsExcludingBrackets.to - 1
      )
    )
  }

  // 2. Look forwards, from the character *in front of* the cursor
  const forwardsIncludingBrackets = search(FORWARDS, pos)
  if (forwardsIncludingBrackets) {
    return dispatchSelection(forwardsIncludingBrackets)
  }

  // 3. Look backwards, from the character *behind* the cursor
  const backwardsIncludingBrackets = search(BACKWARDS, pos)
  if (backwardsIncludingBrackets) {
    return dispatchSelection(backwardsIncludingBrackets)
  }

  // 4. Look backwards, from the character *in front of* the cursor
  const backwardsExcludingBrackets = search(BACKWARDS, pos + 1)
  if (backwardsExcludingBrackets) {
    return dispatchSelection(
      EditorSelection.range(
        backwardsExcludingBrackets.from + 1,
        backwardsExcludingBrackets.to - 1
      )
    )
  }

  return false
}

const matchingBracketTheme = EditorView.baseTheme({
  '.cm-matchingBracket': {
    pointerEvents: 'none',
  },
})

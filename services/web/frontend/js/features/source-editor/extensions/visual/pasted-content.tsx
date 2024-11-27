import {
  EditorSelection,
  Range,
  StateEffect,
  StateField,
} from '@codemirror/state'
import { Decoration, EditorView, WidgetType } from '@codemirror/view'
import { undo } from '@codemirror/commands'
import { ancestorNodeOfType } from '../../utils/tree-operations/ancestors'
import ReactDOM from 'react-dom'
import { PastedContentMenu } from '../../components/paste-html/pasted-content-menu'
import { SplitTestProvider } from '../../../../shared/context/split-test-context'

export type PastedContent = { latex: string; text: string }

const pastedContentEffect = StateEffect.define<{
  content: PastedContent
  formatted: boolean
}>()

export const insertPastedContent = (
  view: EditorView,
  { latex, text }: PastedContent
) =>
  view.state.changeByRange(range => {
    // avoid pasting formatted content into a math container
    if (ancestorNodeOfType(view.state, range.anchor, '$MathContainer')) {
      return {
        range: EditorSelection.cursor(range.from + text.length),
        changes: { from: range.from, to: range.to, insert: text },
      }
    }

    return {
      range: EditorSelection.cursor(range.from + latex.length),
      changes: { from: range.from, to: range.to, insert: latex },
    }
  })

export const storePastedContent = (
  content: PastedContent,
  formatted: boolean
) => ({
  effects: pastedContentEffect.of({ content, formatted }),
})

const pastedContentTheme = EditorView.baseTheme({
  '.ol-cm-pasted-content-menu-toggle': {
    background: 'none',
    borderRadius: '8px',
    border: '1px solid rgb(125, 125, 125)',
    color: 'inherit',
    margin: '0 4px',
    opacity: '0.7',
    '&:hover': {
      opacity: '1',
    },
    '& .material-symbols': {
      verticalAlign: 'text-bottom',
    },
  },
  '.ol-cm-pasted-content-menu-popover': {
    backgroundColor: '#fff',
    maxWidth: 'unset',
    '& .popover-content': {
      padding: 0,
    },
    '& .popover-body': {
      color: 'inherit',
      padding: 0,
    },
    '& .popover-arrow::after': {
      borderBottomColor: '#fff',
    },
  },
  '&dark .ol-cm-pasted-content-menu-popover': {
    background: 'rgba(0, 0, 0)',
  },
  '.ol-cm-pasted-content-menu': {
    display: 'flex',
    flexDirection: 'column',
    boxSizing: 'border-box',
    fontSize: '14px',
    fontFamily: 'var(--font-sans)',
  },
  '.ol-cm-pasted-content-menu-item': {
    color: 'inherit',
    border: 'none',
    background: 'none',
    padding: '8px 16px',
    width: '100%',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    whiteSpace: 'nowrap',
    gap: '12px',
    '&[aria-disabled="true"]': {
      color: 'rgba(125, 125, 125, 0.5)',
    },
    '&:hover': {
      backgroundColor: 'rgba(125, 125, 125, 0.2)',
    },
  },
  '.ol-cm-pasted-content-menu-item-label': {
    flex: 1,
    textAlign: 'left',
  },
  '.ol-cm-pasted-content-menu-item-shortcut': {
    textAlign: 'right',
  },
})

export const pastedContent = StateField.define<{
  content: PastedContent
  formatted: boolean
  selection: EditorSelection
} | null>({
  create() {
    return null
  },
  update(value, tr) {
    if (tr.docChanged) {
      // TODO: exclude remote changes (if they don't intersect with changed ranges)?
      value = null
    } else {
      for (const effect of tr.effects) {
        if (effect.is(pastedContentEffect)) {
          value = {
            ...effect.value,
            selection: tr.state.selection,
          }
        }
      }
    }

    return value
  },
  provide(field) {
    return [
      EditorView.decorations.compute([field], state => {
        const value = state.field(field)

        if (!value) {
          return Decoration.none
        }

        const decorations: Range<Decoration>[] = []

        const { content, selection, formatted } = value
        decorations.push(
          Decoration.widget({
            widget: new PastedContentMenuWidget(content, formatted),
            side: 1,
          }).range(selection.main.to)
        )

        return Decoration.set(decorations, true)
      }),
      pastedContentTheme,
    ]
  },
})

class PastedContentMenuWidget extends WidgetType {
  constructor(
    private pastedContent: PastedContent,
    private formatted: boolean
  ) {
    super()
  }

  toDOM(view: EditorView) {
    const element = document.createElement('span')
    ReactDOM.render(
      <SplitTestProvider>
        <PastedContentMenu
          insertPastedContent={this.insertPastedContent}
          view={view}
          formatted={this.formatted}
          pastedContent={this.pastedContent}
        />
      </SplitTestProvider>,
      element
    )
    return element
  }

  insertPastedContent(
    view: EditorView,
    pastedContent: PastedContent,
    formatted: boolean
  ) {
    undo(view)
    view.dispatch(
      insertPastedContent(view, {
        latex: formatted ? pastedContent.latex : pastedContent.text,
        text: pastedContent.text,
      })
    )
    view.dispatch(storePastedContent(pastedContent, formatted))
    view.focus()
  }

  eq(widget: PastedContentMenuWidget) {
    return (
      widget.pastedContent === this.pastedContent &&
      widget.formatted === this.formatted
    )
  }
}

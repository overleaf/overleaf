import {
  Decoration,
  EditorView,
  getTooltip,
  keymap,
  showTooltip,
  Tooltip,
  TooltipView,
  ViewUpdate,
} from '@codemirror/view'
import {
  EditorSelection,
  EditorState,
  Prec,
  SelectionRange,
  StateEffect,
  StateField,
} from '@codemirror/state'
import { ancestorOfNodeWithType } from '../utils/tree-query'
import { ensureSyntaxTree, syntaxTree } from '@codemirror/language'
import {
  FilePathArgument,
  LiteralArgContent,
  RefArgument,
  ShortArg,
  ShortTextArgument,
  UrlArgument,
} from '../lezer-latex/latex.terms.mjs'
import {
  hasNextSnippetField,
  selectedCompletion,
} from '@codemirror/autocomplete'
import { SyntaxNode } from '@lezer/common'

type ActiveTooltip = {
  range: SelectionRange
  tooltip: Tooltip
  command: string
} | null

const createTooltipView = (
  update?: (update: ViewUpdate) => void
): TooltipView => {
  const dom = document.createElement('div')
  dom.role = 'menu'
  dom.classList.add('ol-cm-command-tooltip')
  return { dom, update }
}

const buildTooltip = (
  command: string,
  pos: number,
  value: ActiveTooltip,
  commandNode: SyntaxNode,
  argumentNode?: SyntaxNode | null,
  update?: (update: ViewUpdate) => void
): ActiveTooltip => {
  if (!argumentNode) {
    return null
  }

  const { from, to } = commandNode

  // if the node still matches the range (i.e. this is the same node),
  // re-use the tooltip by supplying the same create function
  if (value && from === value.range.from && to === value.range.to) {
    return {
      ...value,
      tooltip: { ...value.tooltip, pos },
    }
  }

  return {
    command,
    range: EditorSelection.range(from, to),
    tooltip: {
      create: () => createTooltipView(update), // ensure a new create function
      arrow: true,
      pos,
    },
  }
}

const createTooltipState = (
  state: EditorState,
  value: ActiveTooltip
): ActiveTooltip => {
  // NOTE: only handling the main selection
  const { main } = state.selection
  const pos = main.head
  const node = syntaxTree(state).resolveInner(pos, 0)
  const commandNode = ancestorOfNodeWithType(node, '$CommandTooltipCommand')
  if (!commandNode) {
    return null
  }
  // only show the tooltip when the selection is completely inside the node
  if (main.from < commandNode.from || main.to > commandNode.to) {
    return null
  }
  const commandName = commandNode.name

  switch (commandName) {
    // a hyperlink (\href)
    case 'HrefCommand': {
      const argumentNode = commandNode
        .getChild(UrlArgument)
        ?.getChild(LiteralArgContent)

      if (
        argumentNode &&
        state.sliceDoc(argumentNode.from, argumentNode.to).includes('\n')
      ) {
        return null
      }

      const update = (update: ViewUpdate) => {
        const tooltipState = commandTooltipState(update.state)
        const input =
          tooltipState && firstInteractiveElement(update.view, tooltipState)
        if (input && document.activeElement !== input) {
          const commandNode = resolveCommandNode(update.state)
          const argumentNode = commandNode
            ?.getChild(UrlArgument)
            ?.getChild(LiteralArgContent)

          if (argumentNode) {
            const url = update.state.sliceDoc(
              argumentNode.from,
              argumentNode.to
            )
            if (url !== input.value) {
              input.dispatchEvent(
                new CustomEvent('value-update', {
                  detail: url,
                })
              )
            }
          }
        }
      }

      return buildTooltip(
        commandName,
        pos,
        value,
        commandNode,
        argumentNode,
        update
      )
    }

    // a URL (\url)
    case 'UrlCommand': {
      const argumentNode = commandNode
        .getChild(UrlArgument)
        ?.getChild(LiteralArgContent)

      if (argumentNode) {
        const content = state
          .sliceDoc(argumentNode.from, argumentNode.to)
          .trim()

        if (
          !content ||
          content.includes('\n') ||
          !/^https?:\/\/\w+/.test(content)
        ) {
          return null
        }
      }

      return buildTooltip(commandName, pos, value, commandNode, argumentNode)
    }

    // a cross-reference (\ref)
    case 'Ref': {
      const argumentNode = commandNode
        .getChild(RefArgument)
        ?.getChild(ShortTextArgument)
        ?.getChild(ShortArg)

      return buildTooltip(commandName, pos, value, commandNode, argumentNode)
    }

    // an included file (\include)
    case 'Include': {
      const argumentNode = commandNode
        .getChild('IncludeArgument')
        ?.getChild(FilePathArgument)
        ?.getChild(LiteralArgContent)

      return buildTooltip(commandName, pos, value, commandNode, argumentNode)
    }

    // an input file (\input)
    case 'Input': {
      const argumentNode = commandNode
        .getChild('InputArgument')
        ?.getChild(FilePathArgument)
        ?.getChild(LiteralArgContent)

      return buildTooltip(commandName, pos, value, commandNode, argumentNode)
    }

    // a subfile file (\subfile)
    case 'Subfile': {
      const argumentNode = commandNode
        .getChild('SubfileArgument')
        ?.getChild(FilePathArgument)
        ?.getChild(LiteralArgContent)

      return buildTooltip(commandName, pos, value, commandNode, argumentNode)
    }
  }

  return null
}

const commandTooltipTheme = EditorView.baseTheme({
  '&light .cm-tooltip.ol-cm-command-tooltip': {
    border: '1px lightgray solid',
    background: '#fefefe',
    color: '#111',
    boxShadow: '2px 3px 5px rgb(0 0 0 / 20%)',
  },
  '&dark .cm-tooltip.ol-cm-command-tooltip': {
    border: '1px #484747 solid',
    background: '#25282c',
    color: '#c1c1c1',
    boxShadow: '2px 3px 5px rgba(0, 0, 0, 0.51)',
  },
  '.ol-cm-command-tooltip-content': {
    padding: '8px 0',
    display: 'flex',
    flexDirection: 'column',
  },
  '.btn-link.ol-cm-command-tooltip-link': {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    padding: '4px 12px',
    textDecoration: 'none',
    color: 'inherit',
  },
  '.ol-cm-command-tooltip-form': {
    padding: '0 8px',
  },
})

export const resolveCommandNode = (state: EditorState) => {
  const tooltipState = commandTooltipState(state)
  if (tooltipState) {
    const pos = tooltipState.range.from
    const tree = ensureSyntaxTree(state, pos)
    if (tree) {
      return tree.resolveInner(pos, 1).parent
    }
  }
}

const closeCommandTooltipEffect = StateEffect.define()

export const closeCommandTooltip = () => {
  return {
    effects: closeCommandTooltipEffect.of(null),
  }
}

export const commandTooltipStateField = StateField.define<ActiveTooltip>({
  create(state) {
    return createTooltipState(state, null)
  },
  update(value, tr) {
    if (tr.effects.some(effect => effect.is(closeCommandTooltipEffect))) {
      // close the tooltip if this effect is present
      value = null
    } else if (selectedCompletion(tr.state)) {
      // don't show tooltip if autocomplete is open
      value = null
    } else {
      if (value) {
        // map the stored range through changes
        value.range = value.range.map(tr.changes)
      }
      if (tr.docChanged || tr.selection) {
        // create/update the tooltip
        value = createTooltipState(tr.state, value)
      }
    }

    return value
  },
  provide(field) {
    return [
      // show the tooltip when defined
      showTooltip.from(field, field => (field ? field.tooltip : null)),

      // set attributes on the node with the popover
      EditorView.decorations.from(field, field => {
        if (!field) {
          return Decoration.none
        }

        return Decoration.set(
          Decoration.mark({
            attributes: {
              'aria-haspopup': 'menu',
            },
          }).range(field.range.from, field.range.to)
        )
      }),
    ]
  },
})

export const commandTooltipState = (
  state: EditorState
): ActiveTooltip | undefined => state.field(commandTooltipStateField, false)

const firstInteractiveElement = (
  view: EditorView,
  tooltipState: NonNullable<ActiveTooltip>
) =>
  getTooltip(view, tooltipState.tooltip)?.dom.querySelector<
    HTMLInputElement | HTMLButtonElement
  >('input, button')

const commandTooltipKeymap = Prec.highest(
  keymap.of([
    {
      key: 'Tab',
      // Tab to focus the first element in the tooltip, if open
      run(view) {
        const tooltipState = commandTooltipState(view.state)
        if (tooltipState) {
          const element = firstInteractiveElement(view, tooltipState)
          if (element) {
            // continue to the next snippet if there's already a URL filled in
            if (
              element.type === 'url' &&
              element.value &&
              hasNextSnippetField(view.state)
            ) {
              return false
            }
            element.focus()
            return true
          }
        }

        return false
      },
    },
    {
      key: 'Escape',
      // Escape to close the tooltip, if open
      run(view) {
        const tooltipState = commandTooltipState(view.state)
        if (tooltipState) {
          view.dispatch(closeCommandTooltip())
        }

        return false
      },
    },
  ])
)

export const commandTooltip = [
  commandTooltipStateField,
  commandTooltipKeymap,
  commandTooltipTheme,
]

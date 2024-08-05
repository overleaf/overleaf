import {
  EditorView,
  repositionTooltips,
  showTooltip,
  Tooltip,
  ViewPlugin,
} from '@codemirror/view'
import {
  Compartment,
  EditorState,
  Extension,
  StateField,
  TransactionSpec,
} from '@codemirror/state'
import { loadMathJax } from '../../mathjax/load-mathjax'
import { descendantsOfNodeWithType } from '../utils/tree-query'
import {
  MathContainer,
  mathAncestorNode,
  parseMathContainer,
} from '../utils/tree-operations/math'
import { documentCommands } from '../languages/latex/document-commands'
import { debugConsole } from '@/utils/debugging'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'

const REPOSITION_EVENT = 'editor:repositionMathTooltips'

export const mathPreview = (enabled: boolean): Extension => {
  if (!isSplitTestEnabled('math-preview')) {
    return []
  }

  return mathPreviewConf.of(
    enabled ? [mathPreviewTheme, mathPreviewStateField] : []
  )
}

const mathPreviewConf = new Compartment()

export const setMathPreview = (enabled: boolean): TransactionSpec => ({
  effects: mathPreviewConf.reconfigure(enabled ? mathPreviewStateField : []),
})

const mathPreviewStateField = StateField.define<readonly Tooltip[]>({
  create: buildTooltips,

  update(tooltips, tr) {
    if (tr.docChanged || tr.selection) {
      tooltips = buildTooltips(tr.state)
    }

    return tooltips
  },

  provide: field => [
    showTooltip.computeN([field], state => state.field(field)),

    ViewPlugin.define(view => {
      const listener = () => repositionTooltips(view)
      window.addEventListener(REPOSITION_EVENT, listener)
      return {
        destroy() {
          window.removeEventListener(REPOSITION_EVENT, listener)
        },
      }
    }),
  ],
})

const renderMath = async (
  content: string,
  displayMode: boolean,
  element: HTMLElement,
  definitions: string
) => {
  const MathJax = await loadMathJax()

  MathJax.texReset([0]) // equation numbering is disabled, but this is still needed

  try {
    await MathJax.tex2svgPromise(definitions)
  } catch {
    // ignore errors thrown during parsing command definitions
  }

  const math = await MathJax.tex2svgPromise(content, {
    ...MathJax.getMetricsFor(element),
    display: displayMode,
  })
  element.textContent = ''
  element.append(math)
}

function buildTooltips(state: EditorState): readonly Tooltip[] {
  const tooltips: Tooltip[] = []

  for (const range of state.selection.ranges) {
    if (range.empty) {
      const mathContainer = getMathContainer(state, range.from)
      const content = buildTooltipContent(state, mathContainer)
      if (content && mathContainer) {
        const tooltip: Tooltip = {
          pos: mathContainer.pos,
          above: true,
          strictSide: true,
          arrow: false,
          create() {
            const dom = document.createElement('div')
            dom.append(content)
            dom.className = 'ol-cm-math-tooltip'

            return { dom, overlap: true, offset: { x: 0, y: 8 } }
          },
        }

        tooltips.push(tooltip)
      }
    }
  }

  return tooltips
}

const getMathContainer = (state: EditorState, pos: number) => {
  // if anywhere inside Math, find the whole Math node
  const ancestorNode = mathAncestorNode(state, pos)
  if (!ancestorNode) return null

  const [node] = descendantsOfNodeWithType(ancestorNode, 'Math', 'Math')
  if (!node) return null

  return parseMathContainer(state, node, ancestorNode)
}

const buildTooltipContent = (
  state: EditorState,
  math: MathContainer | null
): HTMLDivElement | null => {
  if (!math || !math.content.length) return null

  const element = document.createElement('div')
  element.style.opacity = '0'
  element.style.transition = 'opacity .01s ease-in'
  element.textContent = math.content

  let definitions = ''
  const commandState = state.field(documentCommands, false)

  if (commandState?.items) {
    for (const command of commandState.items) {
      if (command.type === 'definition' && command.raw) {
        definitions += `${command.raw}\n`
      }
    }
  }

  renderMath(math.content, math.displayMode, element, definitions)
    .then(() => {
      element.style.opacity = '1'
      window.dispatchEvent(new Event(REPOSITION_EVENT))
    })
    .catch(error => {
      debugConsole.error(error)
    })

  return element
}

/**
 * Styles for the preview tooltip
 */
const mathPreviewTheme = EditorView.baseTheme({
  '&light .ol-cm-math-tooltip': {
    boxShadow: '0px 2px 4px 0px #1e253029',
    border: '1px solid #e7e9ee !important',
    backgroundColor: 'white !important',
  },
  '&dark .ol-cm-math-tooltip': {
    boxShadow: '0px 2px 4px 0px #1e253029',
    border: '1px solid #2f3a4c !important',
    backgroundColor: '#1b222c !important',
  },
})

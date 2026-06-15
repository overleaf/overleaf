import { memo, useEffect } from 'react'
import {
  useCodeMirrorStateContext,
  useCodeMirrorViewContext,
} from './codemirror-context'
import {
  closeCommandTooltip,
  commandTooltipState,
} from '../extensions/command-tooltip'
import ReactDOM from 'react-dom'
import { HrefTooltipContent } from './command-tooltip/href-tooltip'
import { UrlTooltipContent } from './command-tooltip/url-tooltip'
import { RefTooltipContent } from './command-tooltip/ref-tooltip'
import { IncludeTooltipContent } from './command-tooltip/include-tooltip'
import { InputTooltipContent } from './command-tooltip/input-tooltip'
import { getTooltip } from '@codemirror/view'
import { SubfileTooltipContent } from '@/features/source-editor/components/command-tooltip/subfile-tooltip'

export const CodeMirrorCommandTooltip = memo(function CodeMirrorLinkTooltip() {
  const view = useCodeMirrorViewContext()
  const state = useCodeMirrorStateContext()

  const tooltipState = commandTooltipState(state)
  const tooltipView = tooltipState && getTooltip(view, tooltipState.tooltip)

  useEffect(() => {
    if (!tooltipView) {
      return
    }

    const controller = new AbortController()

    tooltipView.dom.addEventListener(
      'keydown',
      (event: KeyboardEvent) => {
        switch (event.key) {
          case 'Escape':
            // Escape to close the tooltip
            event.preventDefault()
            view.dispatch(closeCommandTooltip())
            break

          case 'Tab':
            // Shift+Tab from the first element to return focus to the editor
            if (
              event.shiftKey &&
              document.activeElement ===
                tooltipView?.dom.querySelector('input,button')
            ) {
              event.preventDefault()
              view.focus()
            }

            break

          default:
            break
        }
      },
      { signal: controller.signal }
    )

    return () => controller.abort()
  }, [tooltipView, view])

  if (!tooltipView) {
    return null
  }

  return ReactDOM.createPortal(
    <CodeMirrorCommandTooltipContent command={tooltipState.command} />,
    tooltipView.dom
  )
})

const CodeMirrorCommandTooltipContent = memo<{
  command: string
}>(function CodeMirrorCommandTooltipContent({ command }) {
  switch (command) {
    case 'HrefCommand':
      return <HrefTooltipContent />
    case 'UrlCommand':
      return <UrlTooltipContent />
    case 'Ref':
      return <RefTooltipContent />
    case 'Include':
      return <IncludeTooltipContent />
    case 'Input':
      return <InputTooltipContent />
    case 'Subfile':
      return <SubfileTooltipContent />
    default:
      return null
  }
})

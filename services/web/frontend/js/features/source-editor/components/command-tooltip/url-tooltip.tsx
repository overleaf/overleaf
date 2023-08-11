import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useCodeMirrorStateContext } from '../codemirror-editor'
import { Button } from 'react-bootstrap'
import { resolveCommandNode } from '../../extensions/command-tooltip'
import {
  LiteralArgContent,
  UrlArgument,
} from '../../lezer-latex/latex.terms.mjs'
import Icon from '../../../../shared/components/icon'
import { EditorState } from '@codemirror/state'

export const UrlTooltipContent: FC = () => {
  const { t } = useTranslation()
  const state = useCodeMirrorStateContext()

  return (
    <div className="ol-cm-command-tooltip-content">
      <Button
        type="button"
        bsStyle="link"
        className="ol-cm-command-tooltip-link"
        onClick={() => {
          const url = readUrl(state)
          if (url) {
            window.open(url, '_blank')
          }
        }}
      >
        <Icon type="external-link" fw />
        {t('open_link')}
      </Button>
    </div>
  )
}

const readUrl = (state: EditorState) => {
  const commandNode = resolveCommandNode(state)
  const argumentNode = commandNode
    ?.getChild(UrlArgument)
    ?.getChild(LiteralArgContent)

  if (argumentNode) {
    return state.sliceDoc(argumentNode.from, argumentNode.to)
  }
}

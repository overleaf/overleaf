import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useCodeMirrorStateContext } from '../codemirror-context'
import { resolveCommandNode } from '../../extensions/command-tooltip'
import {
  LiteralArgContent,
  UrlArgument,
} from '../../lezer-latex/latex.terms.mjs'
import { EditorState } from '@codemirror/state'
import { openURL } from '@/features/source-editor/utils/url'
import OLButton from '@/shared/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'

export const UrlTooltipContent: FC = () => {
  const { t } = useTranslation()
  const state = useCodeMirrorStateContext()

  return (
    <div className="ol-cm-command-tooltip-content">
      <OLButton
        variant="link"
        type="button"
        className="ol-cm-command-tooltip-link"
        onClick={() => {
          const url = readUrl(state)
          if (url) {
            openURL(url)
          }
        }}
      >
        <MaterialIcon type="open_in_new" />
        {t('open_link')}
      </OLButton>
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

import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useCodeMirrorStateContext } from '../codemirror-context'
import { resolveCommandNode } from '../../extensions/command-tooltip'
import {
  LiteralArgContent,
  UrlArgument,
} from '../../lezer-latex/latex.terms.mjs'
import Icon from '../../../../shared/components/icon'
import { EditorState } from '@codemirror/state'
import { openURL } from '@/features/source-editor/utils/url'
import OLButton from '@/features/ui/components/ol/ol-button'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
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
        <BootstrapVersionSwitcher
          bs3={<Icon type="external-link" fw />}
          bs5={<MaterialIcon type="open_in_new" />}
        />
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

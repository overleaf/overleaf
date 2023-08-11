import { FC } from 'react'
import { useTranslation } from 'react-i18next'
import { useCodeMirrorStateContext } from '../codemirror-editor'
import { Button } from 'react-bootstrap'
import { resolveCommandNode } from '../../extensions/command-tooltip'
import {
  FilePathArgument,
  LiteralArgContent,
} from '../../lezer-latex/latex.terms.mjs'
import Icon from '../../../../shared/components/icon'
import { EditorState } from '@codemirror/state'

export const InputTooltipContent: FC = () => {
  const { t } = useTranslation()
  const state = useCodeMirrorStateContext()

  return (
    <div className="ol-cm-command-tooltip-content">
      <Button
        type="button"
        bsStyle="link"
        className="ol-cm-command-tooltip-link"
        onClick={() => {
          const name = readFileName(state)
          if (name) {
            window.dispatchEvent(
              new CustomEvent('editor:open-file', {
                detail: { name },
              })
            )
            // TODO: handle file not found
          }
        }}
      >
        <Icon type="edit" fw />
        {t('open_file')}
      </Button>
    </div>
  )
}

const readFileName = (state: EditorState) => {
  const commandNode = resolveCommandNode(state)
  const argumentNode = commandNode
    ?.getChild('InputArgument')
    ?.getChild(FilePathArgument)
    ?.getChild(LiteralArgContent)

  if (argumentNode) {
    return state.sliceDoc(argumentNode.from, argumentNode.to)
  }
}

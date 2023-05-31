import { ListGroupItem } from 'react-bootstrap'
import { ToolbarButtonMenu } from './button-menu'
import Icon from '../../../../shared/components/icon'
import { useCallback } from 'react'
import { FigureModalSource } from '../figure-modal/figure-modal-context'
import { useTranslation } from 'react-i18next'
import { emitCommandEvent } from '../../extensions/toolbar/utils/analytics'
import { useCodeMirrorViewContext } from '../codemirror-editor'

export const InsertFigureDropdown = () => {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()
  const openFigureModal = useCallback(
    (source: FigureModalSource, sourceName: string) => {
      emitCommandEvent(view, `toolbar-figure-modal-${sourceName}`)
      window.dispatchEvent(
        new CustomEvent('figure-modal:open', {
          detail: source,
        })
      )
    },
    [view]
  )
  return (
    <ToolbarButtonMenu
      id="toolbar-figure"
      label={t('toolbar_insert_figure')}
      icon="picture-o"
    >
      <ListGroupItem
        onClick={() =>
          openFigureModal(FigureModalSource.FILE_UPLOAD, 'file-upload')
        }
      >
        <Icon type="upload" fw /> Upload from computer
      </ListGroupItem>
      <ListGroupItem
        onClick={() =>
          openFigureModal(FigureModalSource.FILE_TREE, 'current-project')
        }
      >
        <Icon type="archive" fw /> From project files
      </ListGroupItem>
      <ListGroupItem
        onClick={() =>
          openFigureModal(FigureModalSource.OTHER_PROJECT, 'other-project')
        }
      >
        <Icon type="folder-open" fw /> From another project
      </ListGroupItem>
      <ListGroupItem
        onClick={() => openFigureModal(FigureModalSource.FROM_URL, 'from-url')}
      >
        <Icon type="globe" fw /> From URL
      </ListGroupItem>
    </ToolbarButtonMenu>
  )
}

import { ListGroupItem } from 'react-bootstrap'
import { ToolbarButtonMenu } from './button-menu'
import Icon from '../../../../shared/components/icon'
import { memo, useCallback } from 'react'
import { FigureModalSource } from '../figure-modal/figure-modal-context'
import { useTranslation } from 'react-i18next'
import { emitToolbarEvent } from '../../extensions/toolbar/utils/analytics'
import { useCodeMirrorViewContext } from '../codemirror-editor'
import { insertFigure } from '../../extensions/toolbar/commands'
import getMeta from '@/utils/meta'

export const InsertFigureDropdown = memo(function InsertFigureDropdown() {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()
  const openFigureModal = useCallback(
    (source: FigureModalSource, sourceName: string) => {
      emitToolbarEvent(view, `toolbar-figure-modal-${sourceName}`)
      window.dispatchEvent(
        new CustomEvent('figure-modal:open', {
          detail: { source },
        })
      )
    },
    [view]
  )
  const {
    hasLinkedProjectFileFeature,
    hasLinkedProjectOutputFileFeature,
    hasLinkUrlFeature,
  } = getMeta('ol-ExposedSettings')
  return (
    <ToolbarButtonMenu
      id="toolbar-figure"
      label={t('toolbar_insert_figure')}
      icon="picture-o"
      altCommand={insertFigure}
    >
      <ListGroupItem
        onClick={() =>
          openFigureModal(FigureModalSource.FILE_UPLOAD, 'file-upload')
        }
      >
        <Icon type="upload" fw />
        {t('upload_from_computer')}
      </ListGroupItem>
      <ListGroupItem
        onClick={() =>
          openFigureModal(FigureModalSource.FILE_TREE, 'current-project')
        }
      >
        <Icon type="archive" fw />
        {t('from_project_files')}
      </ListGroupItem>
      {(hasLinkedProjectFileFeature || hasLinkedProjectOutputFileFeature) && (
        <ListGroupItem
          onClick={() =>
            openFigureModal(FigureModalSource.OTHER_PROJECT, 'other-project')
          }
        >
          <Icon type="folder-open" fw />
          {t('from_another_project')}
        </ListGroupItem>
      )}
      {hasLinkUrlFeature && (
        <ListGroupItem
          onClick={() =>
            openFigureModal(FigureModalSource.FROM_URL, 'from-url')
          }
        >
          <Icon type="globe" fw />
          {t('from_url')}
        </ListGroupItem>
      )}
    </ToolbarButtonMenu>
  )
})

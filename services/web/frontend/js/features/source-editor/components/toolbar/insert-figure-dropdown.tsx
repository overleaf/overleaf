import { ToolbarButtonMenu } from './button-menu'
import Icon from '@/shared/components/icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'
import OLListGroupItem from '@/features/ui/components/ol/ol-list-group-item'
import { memo, useCallback } from 'react'
import { FigureModalSource } from '../figure-modal/figure-modal-context'
import { useTranslation } from 'react-i18next'
import { emitToolbarEvent } from '../../extensions/toolbar/utils/analytics'
import { useCodeMirrorViewContext } from '../codemirror-context'
import { insertFigure } from '../../extensions/toolbar/commands'
import getMeta from '@/utils/meta'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'
import { ToolbarButton } from './toolbar-button'

export const InsertFigureDropdown = memo(function InsertFigureDropdown() {
  const { t } = useTranslation()
  const view = useCodeMirrorViewContext()
  const { write } = usePermissionsContext()
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

  if (!write) {
    return (
      <ToolbarButton
        id="toolbar-figure"
        label={t('toolbar_insert_figure')}
        command={() =>
          openFigureModal(FigureModalSource.FILE_TREE, 'current-project')
        }
        icon="add_photo_alternate"
      />
    )
  }

  return (
    <ToolbarButtonMenu
      id="toolbar-figure"
      label={t('toolbar_insert_figure')}
      icon={
        <BootstrapVersionSwitcher
          bs3={<Icon fw type="picture-o" />}
          bs5={<MaterialIcon type="add_photo_alternate" />}
        />
      }
      altCommand={insertFigure}
    >
      <OLListGroupItem
        onClick={() =>
          openFigureModal(FigureModalSource.FILE_UPLOAD, 'file-upload')
        }
      >
        <BootstrapVersionSwitcher
          bs3={<Icon type="upload" fw />}
          bs5={<MaterialIcon type="upload" />}
        />
        {t('upload_from_computer')}
      </OLListGroupItem>
      <OLListGroupItem
        onClick={() =>
          openFigureModal(FigureModalSource.FILE_TREE, 'current-project')
        }
      >
        <BootstrapVersionSwitcher
          bs3={<Icon type="archive" fw />}
          bs5={<MaterialIcon type="inbox" />}
        />
        {t('from_project_files')}
      </OLListGroupItem>
      {(hasLinkedProjectFileFeature || hasLinkedProjectOutputFileFeature) && (
        <OLListGroupItem
          onClick={() =>
            openFigureModal(FigureModalSource.OTHER_PROJECT, 'other-project')
          }
        >
          <BootstrapVersionSwitcher
            bs3={<Icon type="folder-open" fw />}
            bs5={<MaterialIcon type="folder_open" />}
          />
          {t('from_another_project')}
        </OLListGroupItem>
      )}
      {hasLinkUrlFeature && (
        <OLListGroupItem
          onClick={() =>
            openFigureModal(FigureModalSource.FROM_URL, 'from-url')
          }
        >
          <BootstrapVersionSwitcher
            bs3={<Icon type="globe" fw />}
            bs5={<MaterialIcon type="public" />}
          />
          {t('from_url')}
        </OLListGroupItem>
      )}
    </ToolbarButtonMenu>
  )
})

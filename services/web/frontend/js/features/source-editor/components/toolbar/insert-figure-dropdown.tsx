import { ListGroupItem } from 'react-bootstrap'
import { ToolbarButtonMenu } from './button-menu'
import Icon from '../../../../shared/components/icon'
import { useCallback } from 'react'
import { FigureModalSource } from '../figure-modal/figure-modal-context'
import { useTranslation } from 'react-i18next'

export const InsertFigureDropdown = () => {
  const { t } = useTranslation()
  const openFigureModal = useCallback((source: FigureModalSource) => {
    window.dispatchEvent(
      new CustomEvent('figure-modal:open', {
        detail: source,
      })
    )
  }, [])
  return (
    <ToolbarButtonMenu
      id="toolbar-figure"
      label={t('toolbar_insert_figure')}
      icon="picture-o"
    >
      <ListGroupItem
        onClick={() => openFigureModal(FigureModalSource.FILE_UPLOAD)}
      >
        <Icon type="upload" fw /> Upload from computer
      </ListGroupItem>
      <ListGroupItem
        onClick={() => openFigureModal(FigureModalSource.FILE_TREE)}
      >
        <Icon type="archive" fw /> From project files
      </ListGroupItem>
      <ListGroupItem
        onClick={() => openFigureModal(FigureModalSource.OTHER_PROJECT)}
      >
        <Icon type="folder-open" fw /> From another project
      </ListGroupItem>
      <ListGroupItem
        onClick={() => openFigureModal(FigureModalSource.FROM_URL)}
      >
        <Icon type="globe" fw /> From URL
      </ListGroupItem>
    </ToolbarButtonMenu>
  )
}

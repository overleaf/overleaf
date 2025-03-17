import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { ToolbarMenuBar } from './menu-bar'
import { ToolbarProjectTitle } from './project-title'
import { OnlineUsers } from './online-users'
import ShareProjectButton from './share-project-button'
import ChangeLayoutButton from './change-layout-button'
import ShowHistoryButton from './show-history-button'
import { LabsActions } from './labs-actions'

export const Toolbar = () => {
  return (
    <div className="ide-redesign-toolbar">
      <ToolbarMenus />
      <ToolbarProjectTitle />
      <ToolbarButtons />
    </div>
  )
}

const ToolbarMenus = () => {
  const { t } = useTranslation()
  return (
    <div className="ide-redesign-toolbar-menu">
      <div className="ide-redesign-toolbar-home-button">
        <a href="/project" className="ide-redesign-toolbar-home-link">
          <span className="toolbar-ol-logo" aria-label={t('overleaf_logo')} />
          <MaterialIcon type="home" className="toolbar-ol-home-button" />
        </a>
      </div>
      <ToolbarMenuBar />
    </div>
  )
}

const ToolbarButtons = () => {
  return (
    <div className="ide-redesign-toolbar-actions">
      <LabsActions />
      <OnlineUsers />
      <ShowHistoryButton />
      <ChangeLayoutButton />
      <ShareProjectButton />
    </div>
  )
}

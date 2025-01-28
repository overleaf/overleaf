import OLButton from '@/features/ui/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { ToolbarMenuBar } from './menu-bar'
import { ToolbarProjectTitle } from './project-title'
import { OnlineUsers } from './online-users'

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
          <img
            className="toolbar-ol-logo"
            src="/img/ol-brand/overleaf-o-dark.svg"
            alt={t('overleaf_logo')}
          />
          <MaterialIcon type="home" className="toolbar-ol-home-button" />
        </a>
      </div>
      <ToolbarMenuBar />
    </div>
  )
}

const ToolbarButtons = () => {
  const { t } = useTranslation()
  return (
    <div className="ide-redesign-toolbar-actions">
      <OnlineUsers />
      <div className="ide-redesign-toolbar-button-container">
        <OLButton
          variant="link"
          className="ide-redesign-toolbar-button-subdued"
          leadingIcon={<MaterialIcon type="history" />}
        />
      </div>
      <div className="ide-redesign-toolbar-button-container">
        <OLButton
          variant="link"
          className="ide-redesign-toolbar-button-subdued"
          leadingIcon={<MaterialIcon type="send" />}
        >
          {t('submit_title')}
        </OLButton>
      </div>
      <div className="ide-redesign-toolbar-button-container">
        <OLButton
          variant="primary"
          leadingIcon={<MaterialIcon type="person_add" />}
        >
          {t('share')}
        </OLButton>
      </div>
    </div>
  )
}

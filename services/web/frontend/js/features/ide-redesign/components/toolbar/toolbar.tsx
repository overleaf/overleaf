import OLButton from '@/features/ui/components/ol/ol-button'
import MaterialIcon from '@/shared/components/material-icon'
import { useTranslation } from 'react-i18next'
import { ToolbarMenuBar } from './menu-bar'
import { ToolbarProjectTitle } from './project-title'
import { OnlineUsers } from './online-users'
import ShareProjectButton from './share-project-button'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import { useEditorContext } from '@/shared/context/editor-context'
import OLTooltip from '@/features/ui/components/ol/ol-tooltip'
import ChangeLayoutButton from './change-layout-button'

const [publishModalModules] = importOverleafModules('publishModal')
const SubmitProjectButton = publishModalModules?.import.NewPublishToolbarButton

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
  const { permissionsLevel } = useEditorContext()
  const { t } = useTranslation()

  const shouldDisplaySubmitButton =
    (permissionsLevel === 'owner' || permissionsLevel === 'readAndWrite') &&
    SubmitProjectButton

  return (
    <div className="ide-redesign-toolbar-actions">
      <OnlineUsers />
      <div className="ide-redesign-toolbar-button-container">
        <OLTooltip
          id="tooltip-open-history"
          description={t('history')}
          overlayProps={{ delay: 0, placement: 'bottom' }}
        >
          <OLButton
            size="sm"
            variant="ghost"
            className="ide-redesign-toolbar-button-subdued"
            leadingIcon={<MaterialIcon type="history" />}
          />
        </OLTooltip>
      </div>
      <ChangeLayoutButton />
      {shouldDisplaySubmitButton && <SubmitProjectButton />}
      <ShareProjectButton />
    </div>
  )
}

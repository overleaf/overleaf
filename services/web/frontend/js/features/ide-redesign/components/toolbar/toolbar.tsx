import { ToolbarMenuBar } from './menu-bar'
import { ToolbarProjectTitle } from './project-title'
import { OnlineUsers } from './online-users'
import ShareProjectButton from './share-project-button'
import ChangeLayoutButton from './change-layout-button'
import ShowHistoryButton from './show-history-button'
import { LabsActions } from './labs-actions'
import { useLayoutContext } from '@/shared/context/layout-context'
import BackToEditorButton from '@/features/editor-navigation-toolbar/components/back-to-editor-button'
import { useCallback } from 'react'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { ToolbarLogos } from './logos'
import { useEditorContext } from '@/shared/context/editor-context'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import UpgradeButton from './upgrade-button'
import getMeta from '@/utils/meta'

const [publishModalModules] = importOverleafModules('publishModal')
const SubmitProjectButton = publishModalModules?.import.NewPublishToolbarButton

export const Toolbar = () => {
  const { view, setView } = useLayoutContext()
  const { cobranding, permissionsLevel } = useEditorContext()
  const shouldDisplaySubmitButton =
    (permissionsLevel === 'owner' || permissionsLevel === 'readAndWrite') &&
    SubmitProjectButton

  const handleBackToEditorClick = useCallback(() => {
    eventTracking.sendMB('navigation-clicked-history', { action: 'close' })
    setView('editor')
  }, [setView])

  if (view === 'history') {
    return (
      <div className="ide-redesign-toolbar">
        <div className="d-flex align-items-center">
          <BackToEditorButton onClick={handleBackToEditorClick} />
        </div>
        <ToolbarProjectTitle />
        <div /> {/* Empty div used for spacing */}
      </div>
    )
  }

  return (
    <div className="ide-redesign-toolbar">
      <div className="ide-redesign-toolbar-menu">
        <ToolbarLogos cobranding={cobranding} />
        <ToolbarMenuBar />
      </div>
      <ToolbarProjectTitle />
      <div className="ide-redesign-toolbar-actions">
        <LabsActions />
        <OnlineUsers />
        <ShowHistoryButton />
        <ChangeLayoutButton />
        {shouldDisplaySubmitButton && cobranding && (
          <SubmitProjectButton cobranding={cobranding} />
        )}
        <ShareProjectButton />
        {getMeta('ol-showUpgradePrompt') && <UpgradeButton />}
      </div>
    </div>
  )
}

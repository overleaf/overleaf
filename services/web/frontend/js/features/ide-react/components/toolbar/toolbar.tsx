import { useTranslation } from 'react-i18next'
import { ToolbarMenuBar } from './menu-bar'
import { ToolbarProjectTitle } from './project-title'
import { OnlineUsers } from './online-users'
import ShareProjectButton from './share-project-button'
import ChangeLayoutButton from './change-layout-button'
import ShowHistoryButton from './show-history-button'
import { useLayoutContext } from '@/shared/context/layout-context'
import BackToEditorButton from '@/features/editor-navigation-toolbar/components/back-to-editor-button'
import { useCallback } from 'react'
import * as eventTracking from '../../../../infrastructure/event-tracking'
import { ToolbarLogos } from './logos'
import { useEditorContext } from '@/shared/context/editor-context'
import importOverleafModules from '../../../../../macros/import-overleaf-module.macro'
import UpgradeButton from './upgrade-button'
import getMeta from '@/utils/meta'
import { useIdeReactContext } from '@/features/ide-react/context/ide-react-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import SplitTestBadge from '@/shared/components/split-test-badge'

const [publishModalModules] = importOverleafModules('publishModal')
const SubmitProjectButton = publishModalModules?.import.NewPublishToolbarButton

export const Toolbar = () => {
  const { view, restoreView, focusMode, setFocusMode, pdfLayout, setView } =
    useLayoutContext()
  const { cobranding, isRestrictedTokenMember } = useEditorContext()
  const { permissionsLevel } = useIdeReactContext()
  const showUpgradePrompt = getMeta('ol-showUpgradePrompt')
  const upgradeButtonRelocation = useFeatureFlag(
    'editor-upgrade-button-relocation'
  )
  const { t } = useTranslation()
  const shouldDisplaySubmitButton =
    (permissionsLevel === 'owner' || permissionsLevel === 'readAndWrite') &&
    SubmitProjectButton

  const handleBackToEditorClick = useCallback(() => {
    eventTracking.sendMB('navigation-clicked-history', { action: 'close' })
    restoreView()
  }, [restoreView])

  const handleExitFocusMode = useCallback(() => {
    setFocusMode(false)
    eventTracking.sendMB('focus-mode-exit')
  }, [setFocusMode])

  const handleSwitchView = useCallback(() => {
    const newView = view === 'pdf' ? 'editor' : 'pdf'
    setView(newView)
    eventTracking.sendMB('focus-mode-switch-view', { view: newView })
  }, [view, setView])

  if (focusMode) {
    const showViewSwitcher = pdfLayout === 'flat'
    const switchTooltip =
      view === 'pdf' ? t('switch_to_editor') : t('switch_to_pdf')
    const switchIcon = view === 'pdf' ? 'edit' : 'picture_as_pdf'

    return (
      <nav className="ide-redesign-toolbar" aria-label={t('project_actions')}>
        <div className="ide-redesign-toolbar-menu">
          <ToolbarLogos cobranding={cobranding} />
        </div>
        <ToolbarProjectTitle />
        <div className="ide-redesign-toolbar-actions">
          <div className="ide-redesign-toolbar-button-container">
            <SplitTestBadge
              splitTestName="focus-mode"
              displayOnVariants={['enabled']}
            />
          </div>
          {showViewSwitcher && (
            <div className="ide-redesign-toolbar-button-container">
              <OLTooltip
                id="tooltip-switch-view"
                description={switchTooltip}
                overlayProps={{ delay: 0, placement: 'bottom' }}
              >
                <OLIconButton
                  icon={switchIcon}
                  className="ide-redesign-toolbar-button-subdued ide-redesign-toolbar-button-icon"
                  onClick={handleSwitchView}
                  accessibilityLabel={switchTooltip}
                />
              </OLTooltip>
            </div>
          )}
          <ChangeLayoutButton />
          <div className="ide-redesign-toolbar-button-container">
            <OLTooltip
              id="tooltip-exit-focus-mode"
              description={t('exit_focus_mode')}
              overlayProps={{ delay: 0, placement: 'bottom' }}
            >
              <OLIconButton
                icon="close_fullscreen"
                className="ide-redesign-toolbar-button-subdued ide-redesign-toolbar-button-icon"
                onClick={handleExitFocusMode}
                accessibilityLabel={t('exit_focus_mode')}
              />
            </OLTooltip>
          </div>
        </div>
      </nav>
    )
  }

  if (view === 'history') {
    return (
      <nav className="ide-redesign-toolbar" aria-label={t('project_actions')}>
        <div className="d-flex align-items-center">
          <BackToEditorButton onClick={handleBackToEditorClick} />
        </div>
        <ToolbarProjectTitle />
        <div /> {/* Empty div used for spacing */}
      </nav>
    )
  }

  return (
    <nav className="ide-redesign-toolbar" aria-label={t('project_actions')}>
      <div className="ide-redesign-toolbar-menu">
        <ToolbarLogos cobranding={cobranding} />
        <ToolbarMenuBar />
        {showUpgradePrompt && upgradeButtonRelocation && <UpgradeButton />}
      </div>
      <ToolbarProjectTitle />
      <div className="ide-redesign-toolbar-actions">
        <OnlineUsers />
        {!isRestrictedTokenMember && <ShowHistoryButton />}
        <ChangeLayoutButton />
        {shouldDisplaySubmitButton && cobranding && (
          <SubmitProjectButton cobranding={cobranding} />
        )}
        <ShareProjectButton />
        {showUpgradePrompt && !upgradeButtonRelocation && <UpgradeButton />}
      </div>
    </nav>
  )
}

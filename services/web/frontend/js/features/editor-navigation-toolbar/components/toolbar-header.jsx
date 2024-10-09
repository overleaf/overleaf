import React from 'react'
import PropTypes from 'prop-types'
import { useTranslation } from 'react-i18next'
import MenuButton from './menu-button'
import CobrandingLogo from './cobranding-logo'
import BackToProjectsButton from './back-to-projects-button'
import UpgradePrompt from './upgrade-prompt'
import ChatToggleButton from './chat-toggle-button'
import LayoutDropdownButton from './layout-dropdown-button'
import OnlineUsersWidget from './online-users-widget'
import ProjectNameEditableLabel from './project-name-editable-label'
import TrackChangesToggleButton from './track-changes-toggle-button'
import HistoryToggleButton from './history-toggle-button'
import ShareProjectButton from './share-project-button'
import importOverleafModules from '../../../../macros/import-overleaf-module.macro'
import BackToEditorButton from './back-to-editor-button'
import getMeta from '@/utils/meta'
import { isSplitTestEnabled } from '@/utils/splitTestUtils'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

const [publishModalModules] = importOverleafModules('publishModal')
const PublishButton = publishModalModules?.import.default

const offlineModeToolbarButtons = importOverleafModules(
  'offlineModeToolbarButtons'
)
// double opt-in
const enableROMirrorOnClient =
  isSplitTestEnabled('ro-mirror-on-client') &&
  new URLSearchParams(window.location.search).get('ro-mirror-on-client') ===
    'enabled'

const ToolbarHeader = React.memo(function ToolbarHeader({
  cobranding,
  onShowLeftMenuClick,
  chatIsOpen,
  toggleChatOpen,
  reviewPanelOpen,
  toggleReviewPanelOpen,
  historyIsOpen,
  toggleHistoryOpen,
  unreadMessageCount,
  onlineUsers,
  goToUser,
  isRestrictedTokenMember,
  hasPublishPermissions,
  chatVisible,
  projectName,
  renameProject,
  hasRenamePermissions,
  openShareModal,
  trackChangesVisible,
}) {
  const chatEnabled = getMeta('ol-chatEnabled')

  const { t } = useTranslation()
  const shouldDisplayPublishButton = hasPublishPermissions && PublishButton

  return (
    <header
      className="toolbar toolbar-header"
      role="navigation"
      aria-label={t('project_layout_sharing_submission')}
    >
      <div className="toolbar-left">
        <MenuButton onClick={onShowLeftMenuClick} />
        {cobranding && cobranding.logoImgUrl && (
          <CobrandingLogo {...cobranding} />
        )}
        <BackToProjectsButton />
        {enableROMirrorOnClient &&
          offlineModeToolbarButtons.map(
            ({ path, import: { default: OfflineModeToolbarButton } }) => {
              return <OfflineModeToolbarButton key={path} />
            }
          )}
      </div>
      {getMeta('ol-showUpgradePrompt') && (
        <BootstrapVersionSwitcher
          bs3={<UpgradePrompt />}
          bs5={
            <div className="d-flex align-items-center">
              <UpgradePrompt />
            </div>
          }
        />
      )}
      <ProjectNameEditableLabel
        className="toolbar-center"
        projectName={projectName}
        hasRenamePermissions={hasRenamePermissions}
        onChange={renameProject}
      />

      <div className="toolbar-right">
        <OnlineUsersWidget onlineUsers={onlineUsers} goToUser={goToUser} />

        {historyIsOpen ? (
          <BootstrapVersionSwitcher
            bs3={<BackToEditorButton onClick={toggleHistoryOpen} />}
            bs5={
              <div className="d-flex align-items-center">
                <BackToEditorButton onClick={toggleHistoryOpen} />
              </div>
            }
          />
        ) : (
          <>
            {trackChangesVisible && (
              <TrackChangesToggleButton
                onMouseDown={toggleReviewPanelOpen}
                disabled={historyIsOpen}
                trackChangesIsOpen={reviewPanelOpen}
              />
            )}

            <ShareProjectButton onClick={openShareModal} />
            {shouldDisplayPublishButton && (
              <PublishButton cobranding={cobranding} />
            )}

            {!isRestrictedTokenMember && (
              <HistoryToggleButton onClick={toggleHistoryOpen} />
            )}

            <LayoutDropdownButton />

            {chatEnabled && chatVisible && (
              <ChatToggleButton
                chatIsOpen={chatIsOpen}
                onClick={toggleChatOpen}
                unreadMessageCount={unreadMessageCount}
              />
            )}
          </>
        )}
      </div>
    </header>
  )
})

ToolbarHeader.propTypes = {
  onShowLeftMenuClick: PropTypes.func.isRequired,
  cobranding: PropTypes.object,
  chatIsOpen: PropTypes.bool,
  toggleChatOpen: PropTypes.func.isRequired,
  reviewPanelOpen: PropTypes.bool,
  toggleReviewPanelOpen: PropTypes.func.isRequired,
  historyIsOpen: PropTypes.bool,
  toggleHistoryOpen: PropTypes.func.isRequired,
  unreadMessageCount: PropTypes.number.isRequired,
  onlineUsers: PropTypes.array.isRequired,
  goToUser: PropTypes.func.isRequired,
  isRestrictedTokenMember: PropTypes.bool,
  hasPublishPermissions: PropTypes.bool,
  chatVisible: PropTypes.bool,
  projectName: PropTypes.string.isRequired,
  renameProject: PropTypes.func.isRequired,
  hasRenamePermissions: PropTypes.bool,
  openShareModal: PropTypes.func.isRequired,
  trackChangesVisible: PropTypes.bool,
}

export default ToolbarHeader

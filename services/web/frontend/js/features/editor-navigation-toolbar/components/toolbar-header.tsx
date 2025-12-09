import React, { ElementType } from 'react'
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
import TryNewEditorButton from '../try-new-editor-button'
import { OnlineUser } from '@/features/ide-react/context/online-users-context'
import { Cobranding } from '../../../../../types/cobranding'
import { canUseNewEditor } from '@/features/ide-redesign/utils/new-editor-utils'
import { Doc } from '@ol-types/doc'

const [publishModalModules] = importOverleafModules('publishModal') as {
  import: { default: ElementType }
  path: string
}[]
const PublishButton = publishModalModules?.import.default

const offlineModeToolbarButtons = importOverleafModules(
  'offlineModeToolbarButtons'
) as {
  import: { default: ElementType }
  path: string
}[]

// double opt-in
const enableROMirrorOnClient =
  isSplitTestEnabled('ro-mirror-on-client') &&
  new URLSearchParams(window.location.search).get('ro-mirror-on-client') ===
    'enabled'

export type ToolbarHeaderProps = {
  cobranding: Cobranding | undefined
  onShowLeftMenuClick: () => void
  chatIsOpen: boolean
  toggleChatOpen: () => void
  reviewPanelOpen: boolean
  toggleReviewPanelOpen: (e: React.MouseEvent) => void
  historyIsOpen: boolean
  toggleHistoryOpen: () => void
  unreadMessageCount: number
  onlineUsers: OnlineUser[]
  goToUser: (user: OnlineUser) => Promise<Doc | undefined>
  isRestrictedTokenMember: boolean | undefined
  hasPublishPermissions: boolean
  chatVisible: boolean
  projectName: string
  renameProject: (name: string) => void
  hasRenamePermissions: boolean
  openShareModal: () => void
  trackChangesVisible: boolean | undefined
}

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
}: ToolbarHeaderProps) {
  const chatEnabled = getMeta('ol-capabilities')?.includes('chat')

  const { t } = useTranslation()
  const shouldDisplayPublishButton = hasPublishPermissions && PublishButton

  return (
    <nav className="toolbar toolbar-header" aria-label={t('project_actions')}>
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
        <div className="d-flex align-items-center">
          <UpgradePrompt />
        </div>
      )}
      <ProjectNameEditableLabel
        className="toolbar-center"
        projectName={projectName}
        hasRenamePermissions={hasRenamePermissions}
        onChange={renameProject}
      />

      <div className="toolbar-right">
        {canUseNewEditor() && <TryNewEditorButton />}

        <OnlineUsersWidget onlineUsers={onlineUsers} goToUser={goToUser} />

        {historyIsOpen ? (
          <div className="d-flex align-items-center">
            <BackToEditorButton onClick={toggleHistoryOpen} />
          </div>
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
    </nav>
  )
})

export default ToolbarHeader

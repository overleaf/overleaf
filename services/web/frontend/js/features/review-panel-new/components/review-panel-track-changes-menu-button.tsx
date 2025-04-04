import { FC, memo, useState } from 'react'
import { Trans } from 'react-i18next'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import MaterialIcon from '@/shared/components/material-icon'
import { useProjectContext } from '@/shared/context/project-context'
import UpgradeTrackChangesModalLegacy from './upgrade-track-changes-modal-legacy'
import { send, sendMB } from '@/infrastructure/event-tracking'

const sendAnalytics = () => {
  send('subscription-funnel', 'editor-click-feature', 'real-time-track-changes')
  sendMB('paywall-prompt', {
    'paywall-type': 'track-changes',
  })
}

const ReviewPanelTrackChangesMenuButton: FC<{
  menuExpanded: boolean
  setMenuExpanded: React.Dispatch<React.SetStateAction<boolean>>
}> = ({ menuExpanded, setMenuExpanded }) => {
  const project = useProjectContext()
  const { wantTrackChanges } = useEditorManagerContext()

  const [showModal, setShowModal] = useState(false)

  const handleTrackChangesMenuExpand = () => {
    if (project.features.trackChanges) {
      setMenuExpanded(value => !value)
    } else {
      sendAnalytics()
      setShowModal(true)
    }
  }

  return (
    <>
      <button
        className="track-changes-menu-button"
        onClick={handleTrackChangesMenuExpand}
      >
        {wantTrackChanges && <div className="track-changes-indicator-circle" />}
        {wantTrackChanges ? (
          <Trans
            i18nKey="track_changes_is_on"
            components={{ strong: <strong /> }}
          />
        ) : (
          <Trans
            i18nKey="track_changes_is_off"
            components={{ strong: <strong /> }}
          />
        )}
        <MaterialIcon type={menuExpanded ? 'expand_more' : 'chevron_right'} />
      </button>

      <UpgradeTrackChangesModalLegacy show={showModal} setShow={setShowModal} />
    </>
  )
}

export default memo(ReviewPanelTrackChangesMenuButton)

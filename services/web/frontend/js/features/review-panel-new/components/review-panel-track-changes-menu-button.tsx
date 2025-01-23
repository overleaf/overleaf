import { FC, memo, useState } from 'react'
import { Trans } from 'react-i18next'
import { useEditorManagerContext } from '@/features/ide-react/context/editor-manager-context'
import Icon from '@/shared/components/icon'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'
import { useProjectContext } from '@/shared/context/project-context'
import UpgradeTrackChangesModal from '@/features/source-editor/components/review-panel/upgrade-track-changes-modal'
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
        <BootstrapVersionSwitcher
          bs3={<Icon type={menuExpanded ? 'angle-down' : 'angle-right'} />}
          bs5={
            <MaterialIcon
              type={menuExpanded ? 'expand_more' : 'chevron_right'}
            />
          }
        />
      </button>

      <UpgradeTrackChangesModal show={showModal} setShow={setShowModal} />
    </>
  )
}

export default memo(ReviewPanelTrackChangesMenuButton)

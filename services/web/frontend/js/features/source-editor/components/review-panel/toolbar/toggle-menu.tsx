import { useState } from 'react'
import { Trans } from 'react-i18next'
import Icon from '../../../../../shared/components/icon'
import TrackChangesMenu from '@/features/source-editor/components/review-panel/toolbar/track-changes-menu'
import UpgradeTrackChangesModal from '../upgrade-track-changes-modal'
import { useProjectContext } from '../../../../../shared/context/project-context'
import {
  useReviewPanelUpdaterFnsContext,
  useReviewPanelValueContext,
} from '../../../context/review-panel/review-panel-context'
import { send, sendMB } from '../../../../../infrastructure/event-tracking'
import classnames from 'classnames'

const sendAnalytics = () => {
  send('subscription-funnel', 'editor-click-feature', 'real-time-track-changes')
  sendMB('paywall-prompt', {
    'paywall-type': 'track-changes',
  })
}

function ToggleMenu() {
  const project = useProjectContext()
  const { setShouldCollapse } = useReviewPanelUpdaterFnsContext()
  const { wantTrackChanges, shouldCollapse } = useReviewPanelValueContext()

  const [showModal, setShowModal] = useState(false)

  const handleToggleFullTCStateCollapse = () => {
    if (project.features.trackChanges) {
      setShouldCollapse(value => !value)
    } else {
      sendAnalytics()
      setShowModal(true)
    }
  }

  return (
    <>
      <span className="review-panel-toolbar-label">
        {wantTrackChanges && (
          <span className="review-panel-toolbar-icon-on">
            <Icon type="circle" />
          </span>
        )}

        <button
          className="review-panel-toolbar-collapse-button"
          onClick={handleToggleFullTCStateCollapse}
        >
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
          <span
            className={classnames('rp-tc-state-collapse', {
              'rp-tc-state-collapse-on': shouldCollapse,
            })}
          >
            <Icon type="angle-down" />
          </span>
        </button>
      </span>

      {!shouldCollapse && <TrackChangesMenu />}

      <UpgradeTrackChangesModal show={showModal} setShow={setShowModal} />
    </>
  )
}

export default ToggleMenu

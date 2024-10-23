import { memo, useState } from 'react'
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
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import MaterialIcon from '@/shared/components/material-icon'

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
            <span className="track-changes-indicator-circle" />
          </span>
        )}

        <button
          className="review-panel-toolbar-collapse-button"
          onClick={handleToggleFullTCStateCollapse}
        >
          <span>
            {wantTrackChanges ? <TrackChangesOn /> : <TrackChangesOff />}
          </span>
          <span
            className={classnames('rp-tc-state-collapse', {
              'rp-tc-state-collapse-on': shouldCollapse,
            })}
          >
            <BootstrapVersionSwitcher
              bs3={<Icon type="angle-down" />}
              bs5={<MaterialIcon type="expand_more" />}
            />
          </span>
        </button>
      </span>

      {!shouldCollapse && <TrackChangesMenu />}

      <UpgradeTrackChangesModal show={showModal} setShow={setShowModal} />
    </>
  )
}

const TrackChangesOn = memo(() => {
  return (
    <Trans i18nKey="track_changes_is_on" components={{ strong: <strong /> }} />
  )
})
TrackChangesOn.displayName = 'TrackChangesOn'

const TrackChangesOff = memo(() => (
  <Trans i18nKey="track_changes_is_off" components={{ strong: <strong /> }} />
))
TrackChangesOff.displayName = 'TrackChangesOff'

export default memo(ToggleMenu)

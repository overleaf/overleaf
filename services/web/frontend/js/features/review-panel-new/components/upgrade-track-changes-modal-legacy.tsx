import { useTranslation } from 'react-i18next'
import { useProjectContext } from '@/shared/context/project-context'
import { useUserContext } from '@/shared/context/user-context'
import teaserVideo from '../images/teaser-track-changes.mp4'
import teaserImage from '../images/teaser-track-changes.gif'
import { startFreeTrial, upgradePlan } from '@/main/account-upgrade'
import { memo } from 'react'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLButton from '@/features/ui/components/ol/ol-button'
import OLRow from '@/features/ui/components/ol/ol-row'
import OLCol from '@/features/ui/components/ol/ol-col'
import MaterialIcon from '@/shared/components/material-icon'

type UpgradeTrackChangesModalProps = {
  show: boolean
  setShow: React.Dispatch<React.SetStateAction<boolean>>
}

function UpgradeTrackChangesModalLegacy({
  show,
  setShow,
}: UpgradeTrackChangesModalProps) {
  const { t } = useTranslation()
  const project = useProjectContext()
  const user = useUserContext()

  return (
    <OLModal show={show} onHide={() => setShow(false)}>
      <OLModalHeader closeButton>
        <OLModalTitle>{t('upgrade_to_track_changes')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <div className="teaser-video-container">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video className="teaser-video" autoPlay loop>
            <source src={teaserVideo} type="video/mp4" />
            <img
              src={teaserImage}
              alt={t('demonstrating_track_changes_feature')}
            />
          </video>
        </div>
        <h4 className="teaser-title">
          {t('see_changes_in_your_documents_live')}
        </h4>
        <OLRow>
          <OLCol lg={{ span: 10, offset: 1 }}>
            <ul className="list-unstyled">
              {[
                t('track_any_change_in_real_time'),
                t('review_your_peers_work'),
                t('accept_or_reject_each_changes_individually'),
              ].map(translation => (
                <li key={translation}>
                  <MaterialIcon type="check" className="align-text-bottom" />
                  &nbsp;{translation}
                </li>
              ))}
            </ul>
          </OLCol>
        </OLRow>
        <p className="small">
          {t('already_subscribed_try_refreshing_the_page')}
        </p>
        {project.owner && (
          <div className="text-center">
            {project.owner._id === user.id ? (
              user.allowedFreeTrial ? (
                <OLButton
                  variant="primary"
                  onClick={() => startFreeTrial('track-changes')}
                >
                  {t('try_it_for_free')}
                </OLButton>
              ) : (
                <OLButton
                  variant="primary"
                  onClick={() => upgradePlan('project-sharing')}
                >
                  {t('upgrade')}
                </OLButton>
              )
            ) : (
              <p>
                <strong>
                  {t(
                    'please_ask_the_project_owner_to_upgrade_to_track_changes'
                  )}
                </strong>
              </p>
            )}
          </div>
        )}
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="secondary" onClick={() => setShow(false)}>
          {t('close')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default memo(UpgradeTrackChangesModalLegacy)

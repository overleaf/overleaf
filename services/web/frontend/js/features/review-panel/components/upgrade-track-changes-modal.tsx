import { useTranslation } from 'react-i18next'
import { useProjectContext } from '@/shared/context/project-context'
import { useUserContext } from '@/shared/context/user-context'
import teaserVideo from '../images/teaser-track-changes.mp4'
import teaserImage from '../images/teaser-track-changes.gif'
import { startFreeTrial, upgradePlan } from '@/main/account-upgrade'
import { memo } from 'react'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import OLRow from '@/shared/components/ol/ol-row'
import OLCol from '@/shared/components/ol/ol-col'
import MaterialIcon from '@/shared/components/material-icon'

type UpgradeTrackChangesModalProps = {
  show: boolean
  setShow: React.Dispatch<React.SetStateAction<boolean>>
}

function UpgradeTrackChangesModal({
  show,
  setShow,
}: UpgradeTrackChangesModalProps) {
  const { t } = useTranslation()
  const { project } = useProjectContext()
  const user = useUserContext()

  return (
    <OLModal show={show} onHide={() => setShow(false)}>
      <OLModalHeader>
        <OLModalTitle>{t('upgrade_to_review')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody className="upgrade-track-changes-modal">
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
        <h4 className="teaser-title">{t('get_real_time_track_changes')}</h4>
        <OLRow>
          <OLCol lg={{ span: 10, offset: 1 }}>
            <ul className="list-unstyled">
              {[
                t('see_suggestions_from_collaborators'),
                t('accept_or_reject_individual_edits'),
                t('access_all_premium_features'),
              ].map(translation => (
                <li key={translation}>
                  <MaterialIcon type="check" className="check-icon" />
                  <span>{translation}</span>
                </li>
              ))}
            </ul>
          </OLCol>
        </OLRow>
        {Boolean(project?.owner) && (
          <div className="text-center">
            {project?.owner._id === user.id ? (
              user.allowedFreeTrial ? (
                <OLButton
                  variant="premium"
                  onClick={() => startFreeTrial('track-changes')}
                >
                  {t('try_it_for_free')}
                </OLButton>
              ) : (
                <OLButton
                  variant="premium"
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

export default memo(UpgradeTrackChangesModal)

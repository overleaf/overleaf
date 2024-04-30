import { useTranslation } from 'react-i18next'
import { Row, Col, Button, Modal } from 'react-bootstrap'
import AccessibleModal from '../../../../shared/components/accessible-modal'
import Icon from '../../../../shared/components/icon'
import { useProjectContext } from '../../../../shared/context/project-context'
import { useUserContext } from '../../../../shared/context/user-context'
import { startFreeTrial, upgradePlan } from '../../../../main/account-upgrade'
import { memo } from 'react'
import { useFeatureFlag } from '@/shared/context/split-test-context'

type UpgradeTrackChangesModalProps = {
  show: boolean
  setShow: React.Dispatch<React.SetStateAction<boolean>>
}

function UpgradeTrackChangesModal({
  show,
  setShow,
}: UpgradeTrackChangesModalProps) {
  const { t } = useTranslation()
  const project = useProjectContext()
  const user = useUserContext()

  const hasNewPaywallCta = useFeatureFlag('paywall-cta')

  return (
    <AccessibleModal show={show} onHide={() => setShow(false)}>
      <Modal.Header closeButton>
        <h3>{t('upgrade_to_track_changes')}</h3>
      </Modal.Header>
      <Modal.Body>
        <div className="teaser-video-container">
          {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
          <video className="teaser-video" autoPlay loop>
            <source
              src="/img/teasers/track-changes/teaser-track-changes.mp4"
              type="video/mp4"
            />
            <img
              src="/img/teasers/track-changes/teaser-track-changes.gif"
              alt={t('demonstrating_track_changes_feature')}
            />
          </video>
        </div>
        <h4 className="teaser-title">
          {t('see_changes_in_your_documents_live')}
        </h4>
        <Row>
          <Col md={10} mdOffset={1}>
            <ul className="list-unstyled">
              {[
                t('track_any_change_in_real_time'),
                t('review_your_peers_work'),
                t('accept_or_reject_each_changes_individually'),
              ].map(translation => (
                <li key={translation}>
                  <Icon type="check" /> {translation}
                </li>
              ))}
            </ul>
          </Col>
        </Row>
        <p className="small">
          {t('already_subscribed_try_refreshing_the_page')}
        </p>
        {project.owner && (
          <Row className="text-center">
            {project.owner._id === user.id ? (
              user.allowedFreeTrial ? (
                <Button
                  bsStyle={null}
                  className="btn-primary"
                  onClick={() => startFreeTrial('track-changes')}
                >
                  {hasNewPaywallCta
                    ? t('get_track_changes')
                    : t('try_it_for_free')}
                </Button>
              ) : (
                <Button
                  bsStyle={null}
                  className="btn-primary"
                  onClick={() => upgradePlan('project-sharing')}
                >
                  {t('upgrade')}
                </Button>
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
          </Row>
        )}
      </Modal.Body>
      <Modal.Footer>
        <Button
          bsStyle={null}
          className="btn-secondary"
          onClick={() => setShow(false)}
        >
          {t('close')}
        </Button>
      </Modal.Footer>
    </AccessibleModal>
  )
}

export default memo(UpgradeTrackChangesModal)

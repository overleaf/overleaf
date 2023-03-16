import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import { useTranslation, Trans } from 'react-i18next'
import { SubscriptionDashModalIds } from '../../../../../../../../../../types/subscription/dashboard/modal-ids'
import { postJSON } from '../../../../../../../../infrastructure/fetch-json'
import AccessibleModal from '../../../../../../../../shared/components/accessible-modal'
import { useSubscriptionDashboardContext } from '../../../../../../context/subscription-dashboard-context'
import { cancelPendingSubscriptionChangeUrl } from '../../../../../../data/subscription-url'
import { useLocation } from '../../../../../../../../shared/hooks/use-location'

export function KeepCurrentPlanModal() {
  const modalId: SubscriptionDashModalIds = 'keep-current-plan'
  const [error, setError] = useState(false)
  const [inflight, setInflight] = useState(false)
  const { t } = useTranslation()
  const location = useLocation()
  const { modalIdShown, handleCloseModal, personalSubscription } =
    useSubscriptionDashboardContext()

  async function confirmCancelPendingPlanChange() {
    setError(false)
    setInflight(true)

    try {
      await postJSON(cancelPendingSubscriptionChangeUrl)
      location.reload()
    } catch (e) {
      setError(true)
      setInflight(false)
    }
  }

  if (modalIdShown !== modalId || !personalSubscription) return null

  return (
    <AccessibleModal
      id={modalId}
      show
      animation
      onHide={handleCloseModal}
      backdrop="static"
    >
      <Modal.Header>
        <Modal.Title>{t('change_plan')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        {error && (
          <div className="alert alert-danger" aria-live="polite">
            {t('generic_something_went_wrong')}. {t('try_again')}.{' '}
            {t('generic_if_problem_continues_contact_us')}.
          </div>
        )}
        <p>
          <Trans
            i18nKey="sure_you_want_to_cancel_plan_change"
            values={{
              planName: personalSubscription.plan.name,
            }}
            components={[
              // eslint-disable-next-line react/jsx-key
              <strong />,
            ]}
          />
        </p>
      </Modal.Body>

      <Modal.Footer>
        <button
          disabled={inflight}
          className="btn btn-secondary"
          onClick={handleCloseModal}
        >
          {t('cancel')}
        </button>
        <button
          disabled={inflight}
          className="btn btn-primary"
          onClick={confirmCancelPendingPlanChange}
        >
          {!inflight
            ? t('revert_pending_plan_change')
            : t('processing_uppercase') + '…'}
        </button>
      </Modal.Footer>
    </AccessibleModal>
  )
}

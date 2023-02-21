import { useState } from 'react'
import { Modal } from 'react-bootstrap'
import { useTranslation, Trans } from 'react-i18next'
import { SubscriptionDashModalIds } from '../../../../../../../../../../types/subscription/dashboard/modal-ids'
import { postJSON } from '../../../../../../../../infrastructure/fetch-json'
import AccessibleModal from '../../../../../../../../shared/components/accessible-modal'
import getMeta from '../../../../../../../../utils/meta'
import { useSubscriptionDashboardContext } from '../../../../../../context/subscription-dashboard-context'
import { subscriptionUpdateUrl } from '../../../../../../data/subscription-url'

export function ConfirmChangePlanModal() {
  const modalId: SubscriptionDashModalIds = 'change-to-plan'
  const [error, setError] = useState(false)
  const [inflight, setInflight] = useState(false)
  const { t } = useTranslation()
  const { handleCloseModal, modalIdShown, plans, planCodeToChangeTo } =
    useSubscriptionDashboardContext()
  const planCodesChangingAtTermEnd = getMeta('ol-planCodesChangingAtTermEnd')

  async function handleConfirmChange() {
    setError(false)
    setInflight(true)

    try {
      await postJSON(`${subscriptionUpdateUrl}?origin=confirmChangePlan`, {
        body: {
          plan_code: planCodeToChangeTo,
        },
      })
      window.location.reload()
    } catch (e) {
      setError(true)
      setInflight(false)
    }
  }

  if (modalIdShown !== modalId || !planCodeToChangeTo) return null

  const plan = plans.find(p => p.planCode === planCodeToChangeTo)
  if (!plan) return null

  const planWillChangeAtTermEnd =
    planCodesChangingAtTermEnd?.indexOf(planCodeToChangeTo) > -1

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
            i18nKey="sure_you_want_to_change_plan"
            values={{
              planName: plan.name,
            }}
            components={[
              // eslint-disable-next-line react/jsx-key
              <strong />,
            ]}
          />
        </p>
        {planWillChangeAtTermEnd && (
          <>
            <p>{t('existing_plan_active_until_term_end')}</p>
            <p>{t('want_change_to_apply_before_plan_end')}</p>
          </>
        )}
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
          onClick={handleConfirmChange}
        >
          {!inflight ? t('change_plan') : t('processing_uppercase') + '…'}
        </button>
      </Modal.Footer>
    </AccessibleModal>
  )
}

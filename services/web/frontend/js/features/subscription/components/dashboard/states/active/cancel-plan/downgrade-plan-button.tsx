import { useTranslation } from 'react-i18next'
import { Plan } from '../../../../../../../../../types/subscription/plan'
import { postJSON } from '../../../../../../../infrastructure/fetch-json'
import { subscriptionUpdateUrl } from '../../../../../data/subscription-url'
import ActionButtonText from '../../../action-button-text'
import { useLocation } from '../../../../../../../shared/hooks/use-location'

export default function DowngradePlanButton({
  isButtonDisabled,
  isLoadingSecondaryAction,
  isSuccessSecondaryAction,
  planToDowngradeTo,
  runAsyncSecondaryAction,
}: {
  isButtonDisabled: boolean
  isLoadingSecondaryAction: boolean
  isSuccessSecondaryAction: boolean
  planToDowngradeTo: Plan
  runAsyncSecondaryAction: (promise: Promise<unknown>) => Promise<unknown>
}) {
  const { t } = useTranslation()
  const location = useLocation()
  const buttonText = t('yes_move_me_to_personal_plan')

  async function handleDowngradePlan() {
    try {
      await runAsyncSecondaryAction(
        postJSON(`${subscriptionUpdateUrl}?downgradeToPaidPersonal`, {
          body: { plan_code: planToDowngradeTo.planCode },
        })
      )
      location.reload()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <>
      <button
        className="btn btn-primary"
        onClick={handleDowngradePlan}
        disabled={isButtonDisabled}
      >
        <ActionButtonText
          inflight={isLoadingSecondaryAction || isSuccessSecondaryAction}
          buttonText={buttonText}
        />
      </button>
    </>
  )
}

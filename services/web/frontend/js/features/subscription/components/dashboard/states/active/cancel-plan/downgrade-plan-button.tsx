import { useTranslation } from 'react-i18next'
import { Plan } from '../../../../../../../../../types/subscription/plan'
import { postJSON } from '../../../../../../../infrastructure/fetch-json'
import { subscriptionUpdateUrl } from '../../../../../data/subscription-url'
import { useLocation } from '../../../../../../../shared/hooks/use-location'
import { debugConsole } from '@/utils/debugging'
import OLButton from '@/shared/components/ol/ol-button'

export default function DowngradePlanButton({
  isButtonDisabled,
  isLoading,
  planToDowngradeTo,
  runAsyncSecondaryAction,
}: {
  isButtonDisabled: boolean
  isLoading: boolean
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
      debugConsole.error(e)
    }
  }

  return (
    <OLButton
      variant="primary"
      onClick={handleDowngradePlan}
      disabled={isButtonDisabled}
      isLoading={isLoading}
      loadingLabel={t('processing_uppercase') + '…'}
    >
      {buttonText}
    </OLButton>
  )
}

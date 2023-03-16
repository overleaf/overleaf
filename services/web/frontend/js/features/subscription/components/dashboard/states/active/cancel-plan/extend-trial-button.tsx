import { useTranslation } from 'react-i18next'
import { putJSON } from '../../../../../../../infrastructure/fetch-json'
import { extendTrialUrl } from '../../../../../data/subscription-url'
import ActionButtonText from '../../../action-button-text'
import { useLocation } from '../../../../../../../shared/hooks/use-location'

export default function ExtendTrialButton({
  isButtonDisabled,
  isLoadingSecondaryAction,
  isSuccessSecondaryAction,
  runAsyncSecondaryAction,
}: {
  isButtonDisabled: boolean
  isLoadingSecondaryAction: boolean
  isSuccessSecondaryAction: boolean
  runAsyncSecondaryAction: (promise: Promise<unknown>) => Promise<unknown>
}) {
  const { t } = useTranslation()
  const buttonText = t('ill_take_it')
  const location = useLocation()

  async function handleExtendTrial() {
    try {
      await runAsyncSecondaryAction(putJSON(extendTrialUrl))
      location.reload()
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <>
      <button
        className="btn btn-primary"
        onClick={handleExtendTrial}
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

import { useTranslation } from 'react-i18next'
import { putJSON } from '../../../../../../../infrastructure/fetch-json'
import { extendTrialUrl } from '../../../../../data/subscription-url'
import { useLocation } from '../../../../../../../shared/hooks/use-location'
import { debugConsole } from '@/utils/debugging'
import OLButton from '@/features/ui/components/ol/ol-button'

export default function ExtendTrialButton({
  isButtonDisabled,
  isLoading,
  runAsyncSecondaryAction,
}: {
  isButtonDisabled: boolean
  isLoading: boolean
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
      debugConsole.error(e)
    }
  }

  return (
    <OLButton
      variant="primary"
      onClick={handleExtendTrial}
      disabled={isButtonDisabled}
      isLoading={isLoading}
      bs3Props={{
        loading: isLoading ? t('processing_uppercase') + '…' : buttonText,
      }}
    >
      {buttonText}
    </OLButton>
  )
}

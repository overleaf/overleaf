import { useTranslation } from 'react-i18next'

export default function ActionButtonText({
  inflight,
  buttonText,
}: {
  inflight: boolean
  buttonText: string
}) {
  const { t } = useTranslation()
  return <>{!inflight ? buttonText : t('processing_uppercase') + '…'}</>
}

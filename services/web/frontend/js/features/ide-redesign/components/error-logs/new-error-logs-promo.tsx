import { useTranslation } from 'react-i18next'
import TooltipPromotion from '../tooltip-promo'

const TUTORIAL_KEY = 'new-error-logs-promo'
const EVENT_DATA = { name: 'new-error-logs-promotion' }

export default function NewErrorLogsPromo({
  target,
}: {
  target: HTMLElement | null
}) {
  const { t } = useTranslation()
  if (!target) {
    return null
  }

  return (
    <TooltipPromotion
      target={target}
      tutorialKey={TUTORIAL_KEY}
      eventData={EVENT_DATA}
      className="new-error-logs-promo"
      content={t('error_logs_have_had_an_update')}
      placement="right"
    />
  )
}

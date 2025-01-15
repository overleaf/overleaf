import { MouseEventHandler, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { startFreeTrial } from '@/main/account-upgrade'
import * as eventTracking from '../../infrastructure/event-tracking'
import OLButton from '@/features/ui/components/ol/ol-button'

type StartFreeTrialButtonProps = {
  source: string
  variant?: string
  buttonProps?: React.ComponentProps<typeof OLButton>
  children?: React.ReactNode
  handleClick?: MouseEventHandler<typeof OLButton>
}

export default function StartFreeTrialButton({
  buttonProps = {
    variant: 'secondary',
  },
  children,
  handleClick,
  source,
  variant,
}: StartFreeTrialButtonProps) {
  const { t } = useTranslation()

  useEffect(() => {
    const eventSegmentation: { [key: string]: unknown } = {
      'paywall-type': source,
    }
    if (variant) {
      eventSegmentation.variant = variant
    }
    eventTracking.sendMB('paywall-prompt', eventSegmentation)
  }, [source, variant])

  const onClick = useCallback(
    event => {
      event.preventDefault()

      if (handleClick) {
        handleClick(event)
      }

      startFreeTrial(source, variant)
    },
    [handleClick, source, variant]
  )

  return (
    <OLButton {...buttonProps} onClick={onClick}>
      {children || t('start_free_trial')}
    </OLButton>
  )
}

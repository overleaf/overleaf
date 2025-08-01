import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { startFreeTrial } from '@/main/account-upgrade'
import * as eventTracking from '../../infrastructure/event-tracking'
import OLButton from '@/features/ui/components/ol/ol-button'

type StartFreeTrialButtonProps = {
  source: string
  variant?: string
  buttonProps?: React.ComponentProps<typeof OLButton>
  children?: React.ReactNode
  handleClick?: React.ComponentProps<typeof OLButton>['onClick']
  segmentation?: eventTracking.Segmentation
}

export default function StartFreeTrialButton({
  buttonProps = {
    variant: 'secondary',
  },
  children,
  handleClick,
  source,
  variant,
  segmentation,
}: StartFreeTrialButtonProps) {
  const { t } = useTranslation()

  useEffect(() => {
    const eventSegmentation: { [key: string]: unknown } = {
      'paywall-type': source,
      ...segmentation,
    }
    if (variant) {
      eventSegmentation.variant = variant
    }
    eventTracking.sendMB('paywall-prompt', eventSegmentation)
  }, [source, variant, segmentation])

  const onClick = useCallback(
    (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
      event.preventDefault()

      if (handleClick) {
        handleClick(event)
      }

      startFreeTrial(source, variant, segmentation)
    },
    [handleClick, source, variant, segmentation]
  )

  return (
    <OLButton {...buttonProps} onClick={onClick}>
      {children || t('start_free_trial')}
    </OLButton>
  )
}

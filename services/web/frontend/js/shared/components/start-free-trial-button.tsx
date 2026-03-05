import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { startFreeTrial } from '@/main/account-upgrade'
import * as eventTracking from '../../infrastructure/event-tracking'
import OLButton from '@/shared/components/ol/ol-button'
import { useFeatureFlag } from '@/shared/context/split-test-context'

type StartFreeTrialButtonProps = {
  source: string
  variant?: string
  buttonProps?: React.ComponentProps<typeof OLButton>
  children?: React.ReactNode
  handleClick?: React.ComponentProps<typeof OLButton>['onClick']
  segmentation?: eventTracking.Segmentation
  extraSearchParams?: Record<string, string>
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
  extraSearchParams,
}: StartFreeTrialButtonProps) {
  const { t } = useTranslation()
  const plans2026 = useFeatureFlag('plans-2026-phase-1')

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

      let shouldNavigate = true

      if (handleClick) {
        handleClick(event)
        if (event.isPropagationStopped()) {
          shouldNavigate = false
        }
      }

      startFreeTrial(
        source,
        variant,
        segmentation,
        extraSearchParams,
        shouldNavigate
      )
    },
    [handleClick, source, variant, segmentation, extraSearchParams]
  )

  return (
    <OLButton {...buttonProps} onClick={onClick}>
      {children ||
        (plans2026
          ? t('start_free_trial_without_exclamation')
          : t('start_free_trial'))}
    </OLButton>
  )
}

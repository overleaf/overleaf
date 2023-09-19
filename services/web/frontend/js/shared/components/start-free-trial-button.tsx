import { MouseEventHandler, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import { startFreeTrial } from '../../main/account-upgrade'
import * as eventTracking from '../../infrastructure/event-tracking'

type StartFreeTrialButtonProps = {
  source: string
  variant?: string
  buttonProps?: Button.ButtonProps
  children?: React.ReactNode
  handleClick?: MouseEventHandler<Button>
}

export default function StartFreeTrialButton({
  buttonProps = {
    bsStyle: 'info',
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

      startFreeTrial(source, null, null, variant)
    },
    [handleClick, source, variant]
  )

  return (
    <Button {...buttonProps} onClick={onClick}>
      {children || t('start_free_trial')}
    </Button>
  )
}

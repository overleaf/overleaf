import { MouseEventHandler, useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import { startFreeTrial } from '../../main/account-upgrade'
import * as eventTracking from '../../infrastructure/event-tracking'

type StartFreeTrialButtonProps = {
  source: string
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
}: StartFreeTrialButtonProps) {
  const { t } = useTranslation()

  useEffect(() => {
    eventTracking.sendMB('paywall-prompt', {
      'paywall-type': source,
    })
  }, [source])

  const onClick = useCallback(
    event => {
      event.preventDefault()

      if (handleClick) {
        handleClick(event)
      }

      startFreeTrial(source)
    },
    [handleClick, source]
  )

  return (
    <Button {...buttonProps} onClick={onClick}>
      {children || t('start_free_trial')}
    </Button>
  )
}

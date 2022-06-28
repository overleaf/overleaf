import { useCallback, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { Button } from 'react-bootstrap'
import PropTypes from 'prop-types'
import { useSplitTestContext } from '../context/split-test-context'
import * as eventTracking from '../../infrastructure/event-tracking'

export default function StartFreeTrialButton({
  buttonStyle = 'info',
  children,
  classes = {},
  setStartedFreeTrial,
  source,
}) {
  const { t } = useTranslation()

  const { splitTestVariants } = useSplitTestContext({
    splitTestVariants: PropTypes.object,
  })
  const interstitialPaymentFromPaywallVariant =
    splitTestVariants['interstitial-payment-from-paywall']

  useEffect(() => {
    eventTracking.sendMB('paywall-prompt', { 'paywall-type': source })
  }, [source])

  const handleClick = useCallback(
    event => {
      event.preventDefault()

      eventTracking.send('subscription-funnel', 'upgraded-free-trial', source)
      eventTracking.sendMB('paywall-click', { 'paywall-type': source })

      if (setStartedFreeTrial) {
        setStartedFreeTrial(true)
      }

      const params = new URLSearchParams({
        planCode: 'collaborator_free_trial_7_days',
        ssp: 'true',
        itm_campaign: source,
      })

      if (interstitialPaymentFromPaywallVariant === 'active') {
        window.open(
          `/user/subscription/choose-your-plan?itm_campaign=${source}`
        )
      } else {
        window.open(`/user/subscription/new?${params}`)
      }
    },
    [setStartedFreeTrial, source, interstitialPaymentFromPaywallVariant]
  )

  return (
    <Button
      bsStyle={buttonStyle}
      onClick={handleClick}
      className={classes.button}
    >
      {children || t('start_free_trial')}
    </Button>
  )
}
StartFreeTrialButton.propTypes = {
  buttonStyle: PropTypes.string,
  children: PropTypes.any,
  classes: PropTypes.shape({
    button: PropTypes.string.isRequired,
  }),
  setStartedFreeTrial: PropTypes.func,
  source: PropTypes.string.isRequired,
}

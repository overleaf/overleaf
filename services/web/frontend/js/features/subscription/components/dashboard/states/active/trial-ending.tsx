import { Trans } from 'react-i18next'
import { formatPaymentDateTime } from '../../../../util/payment-dates'

type TrialEndingProps = {
  trialEndsAt: string
  className?: string
}

export function TrialEnding({ trialEndsAt, className }: TrialEndingProps) {
  return (
    <p className={className} data-testid="trial-ending">
      <Trans
        i18nKey="youre_on_free_trial_which_ends_on"
        values={{ date: formatPaymentDateTime(trialEndsAt) }}
        shouldUnescape
        tOptions={{ interpolation: { escapeValue: true } }}
        components={[
          // eslint-disable-next-line react/jsx-key
          <strong />,
        ]}
      />
    </p>
  )
}

import { Trans } from 'react-i18next'
import { Subscription } from '../../../../../../../../types/subscription/dashboard/subscription'

export function TrialEnding({ subscription }: { subscription: Subscription }) {
  if (
    !subscription.recurly.trialEndsAtFormatted ||
    !subscription.recurly.trial_ends_at
  )
    return null

  const endDate = new Date(subscription.recurly.trial_ends_at)
  if (endDate.getTime() < Date.now()) return null

  return (
    <p>
      <Trans
        i18nKey="youre_on_free_trial_which_ends_on"
        values={{ date: subscription.recurly.trialEndsAtFormatted }}
        components={[
          // eslint-disable-next-line react/jsx-key
          <strong />,
        ]}
      />
    </p>
  )
}

import { Trans } from 'react-i18next'

export function TrialEnding({
  trialEndsAtFormatted,
}: {
  trialEndsAtFormatted: string
}) {
  return (
    <p>
      <Trans
        i18nKey="youre_on_free_trial_which_ends_on"
        values={{ date: trialEndsAtFormatted }}
        components={[
          // eslint-disable-next-line react/jsx-key
          <strong />,
        ]}
      />
    </p>
  )
}

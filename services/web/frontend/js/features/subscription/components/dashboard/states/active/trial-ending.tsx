import { Trans } from 'react-i18next'

export function TrialEnding({
  trialEndsAt,
  trialEndsAtFormatted,
}: {
  trialEndsAt: string
  trialEndsAtFormatted: string
}) {
  const endDate = new Date(trialEndsAt)
  if (endDate.getTime() < Date.now()) return null

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

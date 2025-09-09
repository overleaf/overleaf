import { Trans } from 'react-i18next'

type TrialEndingProps = {
  trialEndsAtFormatted: string
  className?: string
}

export function TrialEnding({
  trialEndsAtFormatted,
  className,
}: TrialEndingProps) {
  return (
    <p className={className} data-testid="trial-ending">
      <Trans
        i18nKey="youre_on_free_trial_which_ends_on"
        values={{ date: trialEndsAtFormatted }}
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

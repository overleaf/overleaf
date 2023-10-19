import { Trans } from 'react-i18next'

export function PendingAdditionalLicenses({
  additionalLicenses,
  totalLicenses,
}: {
  additionalLicenses: number
  totalLicenses: number
}) {
  return (
    <Trans
      i18nKey="additional_licenses"
      values={{
        additionalLicenses,
        totalLicenses,
      }}
      shouldUnescape
      tOptions={{ interpolation: { escapeValue: true } }}
      components={[
        // eslint-disable-next-line react/jsx-key
        <strong />,
        // eslint-disable-next-line react/jsx-key
        <strong />,
      ]}
    />
  )
}

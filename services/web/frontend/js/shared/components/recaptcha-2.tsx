import ReCAPTCHA from 'react-google-recaptcha'
import getMeta from '@/utils/meta'
import { ExposedSettings } from '../../../../types/exposed-settings'

interface ReCaptcha2Props extends Pick<
  React.ComponentProps<typeof ReCAPTCHA>,
  'onChange'
> {
  page: keyof ExposedSettings['recaptchaDisabled']
  recaptchaRef: React.LegacyRef<ReCAPTCHA>
}

export function ReCaptcha2({
  page: site,
  onChange,
  recaptchaRef,
}: ReCaptcha2Props) {
  const { recaptchaSiteKey, recaptchaDisabled } = getMeta('ol-ExposedSettings')

  if (!recaptchaSiteKey) {
    return null
  }
  if (site && recaptchaDisabled[site]) {
    return null
  }
  if (process.env.NODE_ENV === 'development' && window.Cypress) {
    return null // Disable captcha for E2E tests in dev-env.
  }
  return (
    <ReCAPTCHA
      ref={recaptchaRef}
      size="invisible"
      sitekey={recaptchaSiteKey}
      onChange={onChange}
      badge="inline"
    />
  )
}

import { forwardRef } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'
import getMeta from '@/utils/meta'
import { ExposedSettings } from '../../../../types/exposed-settings'

type Page = keyof ExposedSettings['recaptchaDisabled']

export const ReCaptcha2 = forwardRef<
  ReCAPTCHA,
  { page: Page; onChange?: (token: string | null) => void }
>(function ReCaptcha2({ page: site, onChange }, ref) {
  const { recaptchaSiteKey, recaptchaDisabled } = getMeta('ol-ExposedSettings')

  if (!recaptchaSiteKey) {
    return null
  }
  if (site && recaptchaDisabled[site]) {
    return null
  }
  return (
    <ReCAPTCHA
      ref={ref}
      size="invisible"
      sitekey={recaptchaSiteKey}
      onChange={onChange}
      badge="inline"
    />
  )
})

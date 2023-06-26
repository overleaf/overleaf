import { forwardRef } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'

const siteKey = window.ExposedSettings.recaptchaSiteKey
const recaptchaDisabled = window.ExposedSettings.recaptchaDisabled
type Page = keyof typeof recaptchaDisabled

export const ReCaptcha2 = forwardRef<
  ReCAPTCHA,
  { page: Page; onChange?: (token: string | null) => void }
>(function ReCaptcha2({ page: site, onChange }, ref) {
  if (!siteKey) {
    return null
  }
  if (site && recaptchaDisabled[site]) {
    return null
  }
  return (
    <ReCAPTCHA
      ref={ref}
      size="invisible"
      sitekey={siteKey}
      onChange={onChange}
      badge="inline"
    />
  )
})

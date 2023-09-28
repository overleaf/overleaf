import { Trans } from 'react-i18next'

export default function RecaptchaConditions() {
  // the component link children below will be overwritten by the translation string
  return (
    <div className="recaptcha-branding">
      <Trans
        i18nKey="recaptcha_conditions"
        components={{
          1: (
            <a
              rel="noopener noreferrer"
              target="_blank"
              href="https://policies.google.com/privacy"
            >
              Privacy Policy
            </a>
          ),
          2: (
            <a
              rel="noopener noreferrer"
              target="_blank"
              href="https://policies.google.com/terms"
            >
              Terms of Service
            </a>
          ),
        }}
      />
    </div>
  )
}

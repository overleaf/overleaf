import { useRef } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'

export const useRecaptcha = () => {
  const ref = useRef<ReCAPTCHA | null>(null)

  const getReCaptchaToken = async (): Promise<
    ReturnType<ReCAPTCHA['executeAsync']>
  > => {
    if (!ref.current) {
      return null
    }
    // Reset the reCAPTCHA before each submission.
    // The reCAPTCHA token is meant to be used once per validation
    ref.current.reset()
    return await ref.current.executeAsync()
  }

  return { ref, getReCaptchaToken }
}

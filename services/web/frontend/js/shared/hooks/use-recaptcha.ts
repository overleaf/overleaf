import { LegacyRef, createRef } from 'react'
import ReCAPTCHA from 'react-google-recaptcha'

export const useRecaptcha = () => {
  const ref: LegacyRef<ReCAPTCHA> = createRef<ReCAPTCHA>()
  const getReCaptchaToken = async (): Promise<string | null> => {
    if (!ref.current) {
      return null
    }
    return await ref.current.executeAsync()
  }
  return { ref, getReCaptchaToken }
}

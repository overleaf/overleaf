export interface ReCaptchaConfig {
  callback: (token: string) => void
  'error-callback'?: () => void
  'expired-callback'?: () => void
}

export interface ReCaptchaInstance {
  render: (element: HTMLElement | string, config: ReCaptchaConfig) => string
  execute: (recaptchaId: string) => Promise<string>
  reset: (recaptchaId?: string) => void
  enterprise?: {
    ready: (callback: () => void) => void
    execute: (siteKey: string, options: { action: string }) => Promise<string>
  }
}

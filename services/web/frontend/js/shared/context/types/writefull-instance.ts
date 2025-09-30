export interface WritefullEvents {
  'writefull-login-complete': {
    method: 'email-password' | 'login-with-overleaf'
    isPremium: boolean
  }
  'writefull-received-suggestions': { numberOfSuggestions: number }
  'writefull-register-as-auto-account': { email: string }
  'writefull-ai-assist-show-paywall': { origin?: string }
}

export interface WritefullAPI {
  init(): Promise<void>
  addEventListener<eventName extends keyof WritefullEvents>(
    name: eventName,
    callback: (detail: WritefullEvents[eventName]) => void
  ): void
  removeEventListener<eventName extends keyof WritefullEvents>(
    name: eventName,
    callback: (detail: WritefullEvents[eventName]) => void
  ): void
  openTableGenerator(): void
  openEquationGenerator(): void
}

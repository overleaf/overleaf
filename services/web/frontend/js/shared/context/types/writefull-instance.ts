export interface WritefullEvents {
  'writefull-login-complete': {
    method: 'email-password' | 'login-with-overleaf'
    isPremium: boolean
  }
  'writefull-ai-assist-show-paywall': { origin?: string }
}

export interface WritefullAPI {
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
  openFigureGenerator(): void
}

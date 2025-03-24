export interface WritefullEvents {
  'writefull-login-complete': {
    method: 'email-password' | 'login-with-overleaf'
  }
  'writefull-received-suggestions': { numberOfSuggestions: number }
  'writefull-register-as-auto-account': { email: string }
}

export interface WritefullAPI {
  init({
    hasAgreedToTOS,
    overleafUserId,
  }: {
    hasAgreedToTOS: boolean
    overleafUserId: string
  }): Promise<void>
  addEventListener<eventName extends keyof WritefullEvents>(
    name: eventName,
    callback: (detail: WritefullEvents[eventName]) => void
  ): void
}

export interface WritefullEvents {
  'writefull-login-complete': {
    method: 'email-password' | 'login-with-overleaf'
    isPremium: boolean
  }
  'writefull-received-suggestions': { numberOfSuggestions: number }
  'writefull-register-as-auto-account': { email: string }
  'writefull-shared-analytics': { eventName: string; segmentation: object }
  'writefull-ai-assist-show-paywall': { origin?: string }
}

type InsertPosition = {
  parentSelector: string
  insertBeforeSelector?: string
}

export interface WritefullAPI {
  init({
    toolbarPosition,
    iconPosition,
    hasAgreedToTOS,
    overleafUserId,
    overleafLabels,
  }: {
    toolbarPosition: InsertPosition
    iconPosition: InsertPosition
    hasAgreedToTOS: boolean
    overleafUserId: string
    overleafLabels: {
      autoImport: boolean
      autoCreatedAccount: boolean
      splitTests: Record<string, boolean>
    }
  }): Promise<void>
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

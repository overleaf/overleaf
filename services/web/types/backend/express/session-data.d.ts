import 'express-session'

// Add properties to Express's SessionData object that are expected to be
// present in controllers.
declare module 'express-session' {
  // eslint-disable-next-line no-unused-vars
  interface SessionData {
    postCheckoutRedirect?: string
    postLoginRedirect?: string
    postOnboardingRedirect?: string
    sharedProjectData?: any
    templateData?: any
    saml?: {
      reconfirmed?: boolean
      linked?: {
        universityName?: string
        providerName?: string
      }
      linkedGroup?: any
      requestedEmail?: string
      emailNonCanonical?: string
      institutionEmail?: string
      registerIntercept?: boolean
      error?: any
    }
    samlBeta?: boolean
    // Add further properties as needed
  }
}

export type OAuthProvider = {
  name: string
  descriptionKey: string
  descriptionOptions: {
    appName: string
    link?: string
    service?: string
  }
  hideWhenNotLinked?: boolean
  linkPath: string
}

export type OAuthProviders = Record<string, OAuthProvider>

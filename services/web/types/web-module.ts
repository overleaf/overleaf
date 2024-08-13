type LinkedFileAgent = {
  createLinkedFile: (
    projectId: string,
    linkedFileData: object,
    name: string,
    parentFolderId: string,
    userId: string,
    callback: () => void
  ) => void
  refreshLinkedFile: (
    projectId: string,
    linkedFileData: object,
    name: string,
    parentFolderId: string,
    userId: string,
    callback: () => void
  ) => void
  promises: {
    createLinkedFile: (
      projectId: string,
      linkedFileData: object,
      name: string,
      parentFolderId: string,
      userId: string
    ) => Promise<any>
    refreshLinkedFile: (
      projectId: string,
      linkedFileData: object,
      name: string,
      parentFolderId: string,
      userId: string
    ) => Promise<any>
  }
}

export type WebModule = {
  dependencies?: string[]
  router?: {
    apply?: (
      webRouter: any,
      privateApiRouter?: any,
      publicApiRouter?: any
    ) => void
  }
  nonCsrfRouter?: {
    apply: (webRouter: any, privateApiRouter: any, publicApiRouter: any) => void
  }
  hooks?: {
    [name: string]: (args: any[]) => void
  }
  middleware?: {
    [name: string]: (req: any, res: any, next: any) => void
  }
  sessionMiddleware?: (webRouter: any, options: any) => void
  start?: () => Promise<void>
  appMiddleware?: (app: any) => void
  linkedFileAgents?: {
    [name: string]: () => LinkedFileAgent
  }
}

import type { RequestHandler } from 'express'

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
    applyNonCsrfRouter?: (
      webRouter: any,
      privateApiRouter?: any,
      publicApiRouter?: any
    ) => void
  }
  nonCsrfRouter?: {
    apply: (webRouter: any, privateApiRouter: any, publicApiRouter: any) => void
  }
  hooks?: {
    promises?: {
      [name: string]: (...args: any[]) => Promise<any>
    }
    [name: string]: ((...args: any[]) => void) | any
  }
  middleware?: {
    [name: string]: RequestHandler
  }
  sessionMiddleware?: (webRouter: any, options: any) => void
  start?: () => Promise<void>
  appMiddleware?: (app: any) => void
  linkedFileAgents?: {
    [name: string]: () => LinkedFileAgent
  }
  viewIncludes?: Record<string, string[]>
}

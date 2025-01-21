import { postJSON } from '../../../infrastructure/fetch-json'

export const refreshProjectMetadata = (projectId: string, entityId: string) =>
  postJSON(`/project/${projectId}/doc/${entityId}/metadata`)

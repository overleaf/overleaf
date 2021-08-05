import { postJSON } from '../../../infrastructure/fetch-json'

export const refreshProjectMetadata = (projectId, entityId) =>
  postJSON(`/project/${projectId}/doc/${entityId}/metadata`)

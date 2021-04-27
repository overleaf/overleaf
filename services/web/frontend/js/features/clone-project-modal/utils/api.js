import { postJSON } from '../../../infrastructure/fetch-json'

export function cloneProject(projectId, cloneName) {
  return postJSON(`/project/${projectId}/clone`, {
    body: {
      projectName: cloneName,
    },
  })
}

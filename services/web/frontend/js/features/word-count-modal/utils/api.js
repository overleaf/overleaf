import { getJSON } from '../../../infrastructure/fetch-json'

export function fetchWordCount(projectId, clsiServerId, options) {
  let query = ''
  if (clsiServerId) {
    query = `?clsiserverid=${clsiServerId}`
  }

  return getJSON(`/project/${projectId}/wordcount${query}`, options)
}

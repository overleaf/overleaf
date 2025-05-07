import Settings from '@overleaf/settings'
import { fetchJson } from '@overleaf/fetch-utils'

export async function countConnectedClients(projectId) {
  const url = new URL(Settings.apis.realTime.url)
  url.pathname = `/project/${projectId}/count-connected-clients`
  const { nConnectedClients } = await fetchJson(url)
  return nConnectedClients
}

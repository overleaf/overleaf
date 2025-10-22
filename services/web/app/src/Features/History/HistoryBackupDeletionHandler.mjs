import { fetchNothing } from '@overleaf/fetch-utils'
import Settings from '@overleaf/settings'

async function deleteProject(projectId) {
  if (!Settings.apis.historyBackupDeletion.enabled) return

  const url = new URL(Settings.apis.historyBackupDeletion.url)
  url.pathname += `project/${projectId}/backup`
  await fetchNothing(url, {
    method: 'DELETE',
    basicAuth: {
      user: Settings.apis.historyBackupDeletion.user,
      password: Settings.apis.historyBackupDeletion.pass,
    },
  })
}

export default {
  deleteProject,
}

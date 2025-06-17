// @ts-check

const config = require('config')
const { fetchNothing } = require('@overleaf/fetch-utils')

const PROJECT_HISTORY_URL = `http://${config.projectHistory.host}:${config.projectHistory.port}`

async function resyncProject(projectId) {
  await fetchNothing(`${PROJECT_HISTORY_URL}/project/${projectId}/resync`, {
    method: 'POST',
  })
}

module.exports = resyncProject

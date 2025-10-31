import Settings from '@overleaf/settings'

async function run({ assertHasStatusCode, request }) {
  const response = await request(`/project/${Settings.smokeTest.projectId}`)

  assertHasStatusCode(response, 200)

  const PROJECT_ID_REGEX = new RegExp(
    `<meta name="ol-project_id" content="${Settings.smokeTest.projectId}">`
  )
  if (!PROJECT_ID_REGEX.test(response.body)) {
    throw new Error('project page html does not have project_id')
  }
}

export default { run }

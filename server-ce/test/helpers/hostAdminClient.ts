const hostAdminURL = Cypress.env('HOST_ADMIN_URL') || 'http://host-admin'

export async function dockerCompose(cmd: string, ...args: string[]) {
  return await fetchJSON(`${hostAdminURL}/docker/compose/${cmd}`, {
    method: 'POST',
    body: JSON.stringify({
      args,
    }),
  })
}

export async function reconfigure({
  pro = false,
  version = 'latest',
  vars = {},
  withDataDir = false,
  resetData = false,
  mongoVersion = '',
}): Promise<{ previousConfigServer: string }> {
  return await fetchJSON(`${hostAdminURL}/reconfigure`, {
    method: 'POST',
    body: JSON.stringify({
      pro,
      version,
      vars,
      withDataDir,
      resetData,
      mongoVersion,
    }),
  })
}

async function fetchJSON<T = { stdout: string; stderr: string }>(
  input: RequestInfo,
  init?: RequestInit
): Promise<T> {
  if (init?.body) {
    init.headers = { 'Content-Type': 'application/json' }
  }
  let res
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      res = await fetch(input, init)
      break
    } catch {
      await sleep(3_000)
    }
  }
  if (!res) {
    res = await fetch(input, init)
  }
  const { error, stdout, stderr, ...rest } = await res.json()
  if (error) {
    console.error(input, init, 'failed:', error)
    if (stdout) console.log(stdout)
    if (stderr) console.warn(stderr)
    const err = new Error(error.message)
    Object.assign(err, error)
    throw err
  }
  return { stdout, stderr, ...rest }
}

export async function runScript({
  cwd,
  script,
  args = [],
  user = 'www-data',
  hasOverleafEnv = true,
}: {
  cwd: string
  script: string
  args?: string[]
  user?: string
  hasOverleafEnv?: boolean
}) {
  return await fetchJSON(`${hostAdminURL}/run/script`, {
    method: 'POST',
    body: JSON.stringify({
      cwd,
      script,
      args,
      user,
      hasOverleafEnv,
    }),
  })
}

export async function runGruntTask({
  task,
  args = [],
}: {
  task: string
  args?: string[]
}) {
  return await fetchJSON(`${hostAdminURL}/run/gruntTask`, {
    method: 'POST',
    body: JSON.stringify({
      task,
      args,
    }),
  })
}

export async function getRedisKeys() {
  const { stdout } = await fetchJSON(`${hostAdminURL}/redis/keys`, {
    method: 'GET',
  })
  return stdout.split('\n')
}

export async function setMongoFeatureCompatibilityVersion(
  mongoVersion: string
) {
  cy.log(`advancing mongo featureCompatibilityVersion to ${mongoVersion}`)
  await fetchJSON(`${hostAdminURL}/mongo/setFeatureCompatibilityVersion`, {
    method: 'POST',
    body: JSON.stringify({
      mongoVersion,
    }),
  })
}

export async function purgeFilestoreData() {
  const { stdout } = await fetchJSON(`${hostAdminURL}/data/user_files`, {
    method: 'DELETE',
  })
  if (!stdout.trim()) return []
  return stdout.trim().split('\n')
}

async function sleep(ms: number) {
  return await new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

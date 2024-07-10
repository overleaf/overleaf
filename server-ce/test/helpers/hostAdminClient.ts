const hostAdminUrl = Cypress.env('ADMIN_CLIENT_URL') || 'http://host-admin'

export async function dockerCompose(cmd: string, ...args: string[]) {
  return await fetchJSON(`${hostAdminUrl}/docker/compose/${cmd}`, {
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
}) {
  return await fetchJSON(`${hostAdminUrl}/reconfigure`, {
    method: 'POST',
    body: JSON.stringify({
      pro,
      version,
      vars,
      withDataDir,
      resetData,
    }),
  })
}

async function fetchJSON(
  input: RequestInfo,
  init?: RequestInit
): Promise<{ stdout: string; stderr: string }> {
  if (init?.body) {
    init.headers = { 'Content-Type': 'application/json' }
  }
  const res = await fetch(input, init)
  const { error, stdout, stderr } = await res.json()
  if (error) {
    console.error(input, init, 'failed:', error)
    if (stdout) console.log(stdout)
    if (stderr) console.warn(stderr)
    const err = new Error(error.message)
    Object.assign(err, error)
    throw err
  }
  return { stdout, stderr }
}

export async function runScript({
  cwd,
  script,
  args = [],
}: {
  cwd: string
  script: string
  args?: string[]
}) {
  return await fetchJSON(`${hostAdminUrl}/run/script`, {
    method: 'POST',
    body: JSON.stringify({
      cwd,
      script,
      args,
    }),
  })
}

export async function getRedisKeys() {
  const { stdout } = await fetchJSON(`${hostAdminUrl}/redis/keys`, {
    method: 'GET',
  })
  return stdout.split('\n')
}

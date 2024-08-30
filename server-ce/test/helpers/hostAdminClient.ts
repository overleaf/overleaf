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
}): Promise<{ previousConfigServer: string }> {
  return await fetchJSON(`${hostAdminURL}/reconfigure`, {
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
}: {
  cwd: string
  script: string
  args?: string[]
}) {
  return await fetchJSON(`${hostAdminURL}/run/script`, {
    method: 'POST',
    body: JSON.stringify({
      cwd,
      script,
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

async function sleep(ms: number) {
  return new Promise(resolve => {
    setTimeout(resolve, ms)
  })
}

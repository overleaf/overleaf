export async function setVars(vars = {}) {
  return await fetchJSON('http://host-admin/set/vars', {
    method: 'POST',
    body: JSON.stringify({ vars, path: 'docker-compose.yml' }),
  })
}

export async function setVersion({ pro = false, version = 'latest' }) {
  return await fetchJSON('http://host-admin/set/version', {
    method: 'POST',
    body: JSON.stringify({
      pro,
      version,
      path: 'docker-compose.yml',
    }),
  })
}

export async function dockerCompose(cmd: string, ...args: string[]) {
  return await fetchJSON(`http://host-admin/docker/compose/${cmd}`, {
    method: 'POST',
    body: JSON.stringify({
      args,
    }),
  })
}

export async function mongoInit() {
  return await fetchJSON('http://host-admin/mongo/init', {
    method: 'POST',
  })
}

export async function reconfigure({
  pro = false,
  version = 'latest',
  vars = {},
}) {
  return await fetchJSON('http://host-admin/reconfigure', {
    method: 'POST',
    body: JSON.stringify({
      pro,
      version,
      vars,
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
  return await fetchJSON('http://host-admin/run/script', {
    method: 'POST',
    body: JSON.stringify({
      cwd,
      script,
      args,
    }),
  })
}

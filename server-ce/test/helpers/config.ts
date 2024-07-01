import { reconfigure } from './hostAdminClient'

export const STARTUP_TIMEOUT =
  parseInt(Cypress.env('STARTUP_TIMEOUT'), 10) || 120_000

let lastConfig: string

export function startWith({
  pro = false,
  version = 'latest',
  vars = {},
  varsFn = () => ({}),
  withDataDir = false,
}) {
  before(async function () {
    Object.assign(vars, varsFn())
    const cfg = JSON.stringify({
      pro,
      version,
      vars,
      withDataDir,
    })
    if (lastConfig === cfg) return

    this.timeout(STARTUP_TIMEOUT)
    await reconfigure({ pro, version, vars, withDataDir })
    lastConfig = cfg
  })
}

export { reconfigure }

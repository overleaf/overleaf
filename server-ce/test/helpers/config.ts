import { reconfigure } from './hostAdminClient'

let lastConfig: string

export function startWith({
  pro = false,
  version = 'latest',
  vars = {},
  varsFn = () => ({}),
}) {
  before(async function () {
    Object.assign(vars, varsFn())
    const cfg = JSON.stringify({ pro, version, vars })
    if (lastConfig === cfg) return

    this.timeout(100 * 1000)
    await reconfigure({ pro, version, vars })
    lastConfig = cfg
  })
}

export { reconfigure }

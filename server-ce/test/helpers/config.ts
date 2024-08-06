import { reconfigure } from './hostAdminClient'
import { resetActivateUserRateLimit, resetCreatedUsersCache } from './login'

export const STARTUP_TIMEOUT =
  parseInt(Cypress.env('STARTUP_TIMEOUT'), 10) || 120_000

export function isExcludedBySharding(
  shard:
    | 'CE_DEFAULT'
    | 'CE_CUSTOM_1'
    | 'CE_CUSTOM_2'
    | 'PRO_DEFAULT_1'
    | 'PRO_DEFAULT_2'
    | 'PRO_CUSTOM_1'
    | 'PRO_CUSTOM_2'
    | 'PRO_CUSTOM_3'
) {
  const SHARD = Cypress.env('SHARD')
  return SHARD && shard !== SHARD
}

let previousConfigFrontend: string

export function startWith({
  pro = false,
  version = 'latest',
  vars = {},
  varsFn = () => ({}),
  withDataDir = false,
  resetData = false,
}) {
  before(async function () {
    Object.assign(vars, varsFn())
    const cfg = JSON.stringify({
      pro,
      version,
      vars,
      withDataDir,
      resetData,
    })
    if (resetData) {
      resetCreatedUsersCache()
      resetActivateUserRateLimit()
      // no return here, always reconfigure when resetting data
    } else if (previousConfigFrontend === cfg) {
      return
    }

    this.timeout(STARTUP_TIMEOUT)
    const { previousConfigServer } = await reconfigure({
      pro,
      version,
      vars,
      withDataDir,
      resetData,
    })
    if (previousConfigServer !== cfg) {
      await Cypress.session.clearAllSavedSessions()
    }
    previousConfigFrontend = cfg
  })
}

export { reconfigure }

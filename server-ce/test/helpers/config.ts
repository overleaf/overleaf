import { reconfigure } from './hostAdminClient'
import { resetActivateUserRateLimit, resetCreatedUsersCache } from './login'

export const STARTUP_TIMEOUT =
  parseInt(Cypress.env('STARTUP_TIMEOUT'), 10) || 120_000

export function isExcludedBySharding(
  shard:
    | 'LOCAL_ONLY'
    | 'CE_DEFAULT'
    | 'CE_CUSTOM_1'
    | 'PRO_DEFAULT_1'
    | 'PRO_DEFAULT_2'
    | 'PRO_CUSTOM_1'
    | 'PRO_CUSTOM_2'
    | 'PRO_CUSTOM_3'
    | 'PRO_CUSTOM_4'
    | 'PRO_CUSTOM_5'
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
  mongoVersion = '',
}) {
  before(async function () {
    Object.assign(vars, varsFn())
    const cfg = JSON.stringify({
      pro,
      version,
      vars,
      withDataDir,
      resetData,
      mongoVersion,
    })
    if (resetData) {
      cy.log('resetting data and sessions')
      resetCreatedUsersCache()
      resetActivateUserRateLimit()
      // no return here, always reconfigure when resetting data
    } else if (previousConfigFrontend === cfg) {
      cy.log(`already running with ${cfg}`)
      return
    }
    cy.log(`starting with ${cfg}`)

    this.timeout(STARTUP_TIMEOUT)
    previousConfigFrontend = ''
    const { previousConfigServer } = await reconfigure({
      pro,
      version,
      vars,
      withDataDir,
      resetData,
      mongoVersion,
    })
    if (previousConfigServer !== cfg) {
      await Cypress.session.clearAllSavedSessions()
    }
    previousConfigFrontend = cfg
  })
}

// Allow reloading the server in other places, e.g. beforeEach hooks.
export async function reloadWith({
  pro = false,
  version = 'latest',
  vars = {},
  varsFn = () => ({}),
  withDataDir = false,
  resetData = false,
  mongoVersion = '',
}) {
  Object.assign(vars, varsFn())
  const cfg = JSON.stringify({
    pro,
    version,
    vars,
    withDataDir,
    resetData,
    mongoVersion,
  })
  if (resetData) {
    resetCreatedUsersCache()
    resetActivateUserRateLimit()
    // no return here, always reconfigure when resetting data
  } else if (previousConfigFrontend === cfg) {
    return
  }
  previousConfigFrontend = ''
  const { previousConfigServer } = await reconfigure({
    pro,
    version,
    vars,
    withDataDir,
    resetData,
    mongoVersion,
  })
  if (previousConfigServer !== cfg) {
    await Cypress.session.clearAllSavedSessions()
  }
  previousConfigFrontend = cfg
}

export { reconfigure }

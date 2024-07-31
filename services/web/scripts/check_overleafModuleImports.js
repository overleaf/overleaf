function getOverleafModuleImports(settings) {
  return Object.keys(settings.overleafModuleImports).sort().join(',')
}

const CE_CONFIG = require('../config/settings.defaults')
const PRO_CONFIG = require('../config/settings.overrides.server-pro')
const SAAS_CONFIG = require('../config/settings.webpack')

function main() {
  const CE = getOverleafModuleImports(CE_CONFIG)
  const PRO = getOverleafModuleImports(CE_CONFIG.mergeWith(PRO_CONFIG))
  const SAAS = getOverleafModuleImports(CE_CONFIG.mergeWith(SAAS_CONFIG))

  if (CE !== PRO) {
    throw new Error(
      'settings.defaults is missing overleafModuleImports defined in settings.overrides.server-pro'
    )
  }
  if (CE !== SAAS) {
    throw new Error(
      'settings.defaults is missing overleafModuleImports defined in settings.webpack'
    )
  }
}

main()

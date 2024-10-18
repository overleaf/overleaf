import CE_CONFIG from '../config/settings.defaults.js'
import PRO_CONFIG from '../config/settings.overrides.server-pro.js'
import SAAS_CONFIG from '../config/settings.webpack.js'

function getOverleafModuleImports(settings) {
  return Object.keys(settings.overleafModuleImports).sort().join(',')
}

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

const fs = require('fs')
const Path = require('path')
const async = require('async')
const { promisify } = require('util')
const Settings = require('@overleaf/settings')
const Views = require('./Views')

const MODULE_BASE_PATH = Path.join(__dirname, '/../../../modules')

const _modules = []
let _modulesLoaded = false
const _hooks = {}
let _viewIncludes = {}

function modules() {
  if (!_modulesLoaded) {
    loadModules()
  }
  return _modules
}

function loadModules() {
  const settingsCheckModule = Path.join(
    MODULE_BASE_PATH,
    'settings-check',
    'index.js'
  )
  if (fs.existsSync(settingsCheckModule)) {
    require(settingsCheckModule)
  }

  for (const moduleName of Settings.moduleImportSequence || []) {
    const loadedModule = require(
      Path.join(MODULE_BASE_PATH, moduleName, 'index.js')
    )
    loadedModule.name = moduleName
    _modules.push(loadedModule)
    if (loadedModule.viewIncludes) {
      throw new Error(
        `${moduleName}: module.viewIncludes moved into Settings.viewIncludes`
      )
    }
  }
  _modulesLoaded = true
  attachHooks()
}

function applyRouter(webRouter, privateApiRouter, publicApiRouter) {
  for (const module of modules()) {
    if (module.router && module.router.apply) {
      module.router.apply(webRouter, privateApiRouter, publicApiRouter)
    }
  }
}

function applyNonCsrfRouter(webRouter, privateApiRouter, publicApiRouter) {
  for (const module of modules()) {
    if (module.nonCsrfRouter != null) {
      module.nonCsrfRouter.apply(webRouter, privateApiRouter, publicApiRouter)
    }
    if (module.router && module.router.applyNonCsrfRouter) {
      module.router.applyNonCsrfRouter(
        webRouter,
        privateApiRouter,
        publicApiRouter
      )
    }
  }
}

function loadViewIncludes(app) {
  _viewIncludes = Views.compileViewIncludes(app)
}

function registerMiddleware(appOrRouter, middlewareName, options) {
  if (!middlewareName) {
    throw new Error(
      'middleware name must be provided to register module middleware'
    )
  }
  for (const module of modules()) {
    if (module[middlewareName]) {
      module[middlewareName](appOrRouter, options)
    }
  }
}

function moduleIncludes(view, locals) {
  const compiledPartials = _viewIncludes[view] || []
  let html = ''
  for (const compiledPartial of compiledPartials) {
    html += compiledPartial(locals)
  }
  return html
}

function moduleIncludesAvailable(view) {
  return (_viewIncludes[view] || []).length > 0
}

function linkedFileAgentsIncludes() {
  const agents = {}
  for (const module of modules()) {
    for (const name in module.linkedFileAgents) {
      const agentFunction = module.linkedFileAgents[name]
      agents[name] = agentFunction()
    }
  }
  return agents
}

function attachHooks() {
  for (const module of modules()) {
    if (module.hooks != null) {
      for (const hook in module.hooks) {
        const method = module.hooks[hook]
        attachHook(hook, method)
      }
    }
  }
}

function attachHook(name, method) {
  if (_hooks[name] == null) {
    _hooks[name] = []
  }
  _hooks[name].push(method)
}

function fireHook(name, ...rest) {
  // ensure that modules are loaded if we need to fire a hook
  // this can happen if a script calls a method that fires a hook
  if (!_modulesLoaded) {
    loadModules()
  }
  const adjustedLength = Math.max(rest.length, 1)
  const args = rest.slice(0, adjustedLength - 1)
  const callback = rest[adjustedLength - 1]
  const methods = _hooks[name] || []
  const callMethods = methods.map(method => cb => method(...args, cb))
  async.series(callMethods, function (error, results) {
    if (error) {
      return callback(error)
    }
    callback(null, results)
  })
}

module.exports = {
  applyNonCsrfRouter,
  applyRouter,
  linkedFileAgentsIncludes,
  loadViewIncludes,
  moduleIncludes,
  moduleIncludesAvailable,
  registerMiddleware,
  hooks: {
    attach: attachHook,
    fire: fireHook,
  },
  promises: {
    hooks: {
      fire: promisify(fireHook),
    },
  },
}

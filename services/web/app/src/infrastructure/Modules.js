const fs = require('fs')
const Path = require('path')
const pug = require('pug')
const async = require('async')
const { promisify } = require('util')
const Settings = require('@overleaf/settings')

const MODULE_BASE_PATH = Path.join(__dirname, '/../../../modules')

const _modules = []
const _hooks = {}
let _viewIncludes = {}

function loadModules() {
  const settingsCheckModule = Path.join(
    MODULE_BASE_PATH,
    'settings-check',
    'index.js'
  )
  if (fs.existsSync(settingsCheckModule)) {
    require(settingsCheckModule)
  }

  for (const moduleName of Settings.moduleImportSequence) {
    const loadedModule = require(Path.join(
      MODULE_BASE_PATH,
      moduleName,
      'index.js'
    ))
    loadedModule.name = moduleName
    _modules.push(loadedModule)
  }
  attachHooks()
}

function applyRouter(webRouter, privateApiRouter, publicApiRouter) {
  for (const module of _modules) {
    if (module.router && module.router.apply) {
      module.router.apply(webRouter, privateApiRouter, publicApiRouter)
    }
  }
}

function applyNonCsrfRouter(webRouter, privateApiRouter, publicApiRouter) {
  for (const module of _modules) {
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
  _viewIncludes = {}
  for (const module of _modules) {
    const object = module.viewIncludes || {}
    for (const view in object) {
      const partial = object[view]
      if (!_viewIncludes[view]) {
        _viewIncludes[view] = []
      }
      const filePath = Path.join(
        MODULE_BASE_PATH,
        module.name,
        'app/views',
        partial + '.pug'
      )
      _viewIncludes[view].push(
        pug.compileFile(filePath, {
          doctype: 'html',
          compileDebug: Settings.debugPugTemplates,
        })
      )
    }
  }
}

function registerAppMiddleware(app) {
  for (const module of _modules) {
    if (module.appMiddleware) {
      module.appMiddleware(app)
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
  for (const module of _modules) {
    for (const name in module.linkedFileAgents) {
      const agentFunction = module.linkedFileAgents[name]
      agents[name] = agentFunction()
    }
  }
  return agents
}

function attachHooks() {
  for (const module of _modules) {
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
  registerAppMiddleware,
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

loadModules()

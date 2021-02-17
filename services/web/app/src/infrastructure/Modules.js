const fs = require('fs')
const Path = require('path')
const pug = require('pug')
const async = require('async')
const { promisify } = require('util')
const Settings = require('settings-sharelatex')

const MODULE_BASE_PATH = Path.resolve(__dirname + '/../../../modules')

const _modules = []
const _hooks = {}
let _viewIncludes = {}

function loadModules() {
  for (let moduleName of fs.readdirSync(MODULE_BASE_PATH)) {
    if (fs.existsSync(Path.join(MODULE_BASE_PATH, moduleName, 'index.js'))) {
      const loadedModule = require(Path.join(
        MODULE_BASE_PATH,
        moduleName,
        'index'
      ))
      loadedModule.name = moduleName
      _modules.push(loadedModule)
    }
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
  for (let module of _modules) {
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
    for (let view in object) {
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
          compileDebug: Settings.debugPugTemplates
        })
      )
    }
  }
}

function moduleIncludes(view, locals) {
  const compiledPartials = _viewIncludes[view] || []
  let html = ''
  for (let compiledPartial of compiledPartials) {
    html += compiledPartial(locals)
  }
  return html
}

function moduleIncludesAvailable(view) {
  return (_viewIncludes[view] || []).length > 0
}

function linkedFileAgentsIncludes() {
  const agents = {}
  for (let module of _modules) {
    for (let name in module.linkedFileAgents) {
      const agentFunction = module.linkedFileAgents[name]
      agents[name] = agentFunction()
    }
  }
  return agents
}

function attachHooks() {
  for (var module of _modules) {
    if (module.hooks != null) {
      for (let hook in module.hooks) {
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
  async.series(callMethods, function(error, results) {
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
  hooks: {
    attach: attachHook,
    fire: fireHook
  },
  promises: {
    hooks: {
      fire: promisify(fireHook)
    }
  }
}

loadModules()

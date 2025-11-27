// @ts-check

import fs from 'node:fs'

import Path from 'node:path'
import { promisify, callbackify } from 'node:util'
import Settings from '@overleaf/settings'
import Views from './Views.mjs'
import _ from 'lodash'
import Metrics from '@overleaf/metrics'

/** @import { WebModule } from "../../../types/web-module" */
/** @import { RequestHandler } from "express" */

const MODULE_BASE_PATH = Path.join(import.meta.dirname, '/../../../modules')

/** @type {WebModule[]} */
const _modules = []
let _modulesLoaded = false
const _hooks = {}

/** @type {Record<string, RequestHandler[]>} */
const _middleware = {}
let _viewIncludes = {}

async function modules() {
  if (!_modulesLoaded) {
    const beforeLoadModules = performance.now()
    await loadModules()
    Metrics.gauge('web_startup', performance.now() - beforeLoadModules, 1, {
      path: 'loadModules',
    })
  }
  return _modules
}

async function loadModulesImpl() {
  const settingsCheckModule = Path.join(
    MODULE_BASE_PATH,
    'settings-check',
    'index.mjs'
  )
  if (fs.existsSync(settingsCheckModule)) {
    await import(settingsCheckModule)
  }
  for (const moduleName of Settings.moduleImportSequence || []) {
    const module = await import(
      Path.join(MODULE_BASE_PATH, moduleName, 'index.mjs')
    )
    /** @type {WebModule & {name: string}} */
    const loadedModule = module.default || module

    loadedModule.name = moduleName
    _modules.push(loadedModule)
    if (loadedModule.viewIncludes) {
      throw new Error(
        `${moduleName}: module.viewIncludes moved into Settings.viewIncludes`
      )
    }
    if (loadedModule.dependencies) {
      for (const dependency of loadedModule.dependencies) {
        if (!Settings.moduleImportSequence.includes(dependency)) {
          throw new Error(
            `Module '${dependency}' listed as a dependency of '${moduleName}' is missing in the moduleImportSequence. Please also verify that it is available in the current environment.`
          )
        }
      }
    }
  }
  _modulesLoaded = true
  await attachHooks()
  await attachMiddleware()
}

const loadModules = _.memoize(loadModulesImpl)

async function applyRouter(webRouter, privateApiRouter, publicApiRouter) {
  for (const module of await modules()) {
    if (module.router && module.router.apply) {
      await module.router.apply(webRouter, privateApiRouter, publicApiRouter)
    }
  }
}

async function applyNonCsrfRouter(
  webRouter,
  privateApiRouter,
  publicApiRouter
) {
  for (const module of await modules()) {
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

async function start() {
  for (const module of await modules()) {
    await module.start?.()
  }
}

function loadViewIncludes(app) {
  _viewIncludes = Views.compileViewIncludes(app)
}

async function applyMiddleware(appOrRouter, middlewareName, options) {
  if (!middlewareName) {
    throw new Error(
      'middleware name must be provided to register module middleware'
    )
  }
  for (const module of await modules()) {
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

async function linkedFileAgentsIncludes() {
  const agents = {}
  for (const module of await modules()) {
    for (const name in module.linkedFileAgents) {
      const agentFunction = module.linkedFileAgents[name]
      agents[name] = agentFunction()
    }
  }
  return agents
}

async function attachHooks() {
  for (const module of await modules()) {
    const { promises, ...hooks } = module.hooks || {}
    for (const [hook, method] of Object.entries(promises || {})) {
      attachHook(hook, method)
    }
    for (const hook in hooks || {}) {
      const method = hooks[hook]
      attachHook(hook, promisify(method))
    }
  }
}

function attachHook(name, method) {
  if (_hooks[name] == null) {
    _hooks[name] = []
  }
  _hooks[name].push(method)
}

async function attachMiddleware() {
  for (const module of await modules()) {
    if (module.middleware) {
      for (const middleware in module.middleware) {
        const method = module.middleware[middleware]
        if (_middleware[middleware] == null) {
          _middleware[middleware] = []
        }
        _middleware[middleware].push(method)
      }
    }
  }
}

async function fireHook(name, ...args) {
  // ensure that modules are loaded if we need to fire a hook
  // this can happen if a script calls a method that fires a hook
  if (!_modulesLoaded) {
    await loadModules()
  }
  const methods = _hooks[name] || []
  const results = []
  for (const method of methods) {
    const result = await method(...args)
    results.push(result)
  }
  return results
}

/**
 * @param {string} name
 */
async function getMiddleware(name) {
  // ensure that modules are loaded if we need to call a middleware
  if (!_modulesLoaded) {
    await loadModules()
  }
  return _middleware[name] || []
}

export default {
  applyNonCsrfRouter,
  applyRouter,
  linkedFileAgentsIncludes,
  loadViewIncludes,
  moduleIncludes,
  moduleIncludesAvailable,
  applyMiddleware,
  start,
  hooks: {
    attach: attachHook,
    fire: callbackify(fireHook),
  },
  middleware: getMiddleware,
  promises: {
    hooks: {
      fire: fireHook,
    },
  },
}

/* eslint-disable
    camelcase,
    max-len,
    no-path-concat,
    no-unused-vars,
    one-var,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS103: Rewrite code to no longer use __guard__
 * DS201: Simplify complex destructure assignments
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let Modules
const fs = require('fs')
const Path = require('path')
const pug = require('pug')
const async = require('async')

const MODULE_BASE_PATH = Path.resolve(__dirname + '/../../../modules')

module.exports = Modules = {
  modules: [],
  loadModules() {
    for (let moduleName of Array.from(fs.readdirSync(MODULE_BASE_PATH))) {
      if (fs.existsSync(Path.join(MODULE_BASE_PATH, moduleName, 'index.js'))) {
        const loadedModule = require(Path.join(
          MODULE_BASE_PATH,
          moduleName,
          'index'
        ))
        loadedModule.name = moduleName
        this.modules.push(loadedModule)
      }
    }
    return Modules.attachHooks()
  },

  applyRouter(webRouter, privateApiRouter, publicApiRouter) {
    return Array.from(this.modules).map(module =>
      __guardMethod__(module.router, 'apply', o =>
        o.apply(webRouter, privateApiRouter, publicApiRouter)
      )
    )
  },

  applyNonCsrfRouter(webRouter, privateApiRouter, publicApiRouter) {
    return (() => {
      const result = []
      for (let module of Array.from(this.modules)) {
        if (module.nonCsrfRouter != null) {
          module.nonCsrfRouter.apply(
            webRouter,
            privateApiRouter,
            publicApiRouter
          )
        }
        result.push(
          __guardMethod__(module.router, 'applyNonCsrfRouter', o =>
            o.applyNonCsrfRouter(webRouter, privateApiRouter, publicApiRouter)
          )
        )
      }
      return result
    })()
  },

  viewIncludes: {},
  loadViewIncludes(app) {
    this.viewIncludes = {}
    return Array.from(this.modules).map(module =>
      (() => {
        const result = []
        const object = module.viewIncludes || {}
        for (let view in object) {
          const partial = object[view]
          if (!this.viewIncludes[view]) {
            this.viewIncludes[view] = []
          }
          const filePath = Path.join(
            MODULE_BASE_PATH,
            module.name,
            'app/views',
            partial + '.pug'
          )
          result.push(
            this.viewIncludes[view].push(
              pug.compileFile(filePath, { doctype: 'html' })
            )
          )
        }
        return result
      })()
    )
  },

  moduleIncludes(view, locals) {
    const compiledPartials = Modules.viewIncludes[view] || []
    let html = ''
    for (let compiledPartial of Array.from(compiledPartials)) {
      const d = new Date()
      html += compiledPartial(locals)
    }
    return html
  },

  moduleIncludesAvailable(view) {
    return (Modules.viewIncludes[view] || []).length > 0
  },

  moduleAssetFiles(pathPrefix) {
    const assetFiles = []
    for (let module of Array.from(this.modules)) {
      for (let assetFile of Array.from(module.assetFiles || [])) {
        assetFiles.push(`${pathPrefix}${assetFile}`)
      }
    }
    return assetFiles
  },

  linkedFileAgentsIncludes() {
    const agents = {}
    for (let module of Array.from(this.modules)) {
      for (let name in module.linkedFileAgents) {
        const agentFunction = module.linkedFileAgents[name]
        agents[name] = agentFunction()
      }
    }
    return agents
  },

  attachHooks() {
    return (() => {
      const result = []
      for (var module of Array.from(this.modules)) {
        if (module.hooks != null) {
          result.push(
            (() => {
              const result1 = []
              for (let hook in module.hooks) {
                const method = module.hooks[hook]
                result1.push(Modules.hooks.attach(hook, method))
              }
              return result1
            })()
          )
        } else {
          result.push(undefined)
        }
      }
      return result
    })()
  },

  hooks: {
    _hooks: {},
    attach(name, method) {
      if (this._hooks[name] == null) {
        this._hooks[name] = []
      }
      return this._hooks[name].push(method)
    },

    fire(name, ...rest) {
      const adjustedLength = Math.max(rest.length, 1),
        args = rest.slice(0, adjustedLength - 1),
        callback = rest[adjustedLength - 1]
      const methods = this._hooks[name] || []
      const call_methods = methods.map(method => cb =>
        method(...Array.from(args), cb)
      )
      return async.series(call_methods, function(error, results) {
        if (error != null) {
          return callback(error)
        }
        return callback(null, results)
      })
    }
  }
}

Modules.loadModules()

function __guardMethod__(obj, methodName, transform) {
  if (
    typeof obj !== 'undefined' &&
    obj !== null &&
    typeof obj[methodName] === 'function'
  ) {
    return transform(obj, methodName)
  } else {
    return undefined
  }
}

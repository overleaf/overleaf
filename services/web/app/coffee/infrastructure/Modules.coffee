fs   = require "fs"
Path = require "path"
pug = require "pug"
async = require "async"

MODULE_BASE_PATH = Path.resolve(__dirname + "/../../../modules")

module.exports = Modules =
	modules: []
	loadModules: () ->
		for moduleName in fs.readdirSync(MODULE_BASE_PATH)
			if fs.existsSync(Path.join(MODULE_BASE_PATH, moduleName, "index.js"))
				loadedModule = require(Path.join(MODULE_BASE_PATH, moduleName, "index"))
				loadedModule.name = moduleName
				@modules.push loadedModule
		Modules.attachHooks()

	applyRouter: (webRouter, privateApiRouter, publicApiRouter) ->
		for module in @modules
			module.router?.apply?(webRouter, privateApiRouter, publicApiRouter)

	applyNonCsrfRouter: (webRouter, privateApiRouter, publicApiRouter) ->
		for module in @modules
			module.nonCsrfRouter?.apply(webRouter, privateApiRouter, publicApiRouter)
			module.router?.applyNonCsrfRouter?(webRouter, privateApiRouter, publicApiRouter)

	viewIncludes: {}
	loadViewIncludes: (app) ->
		@viewIncludes = {}
		for module in @modules
			for view, partial of module.viewIncludes or {}
				@viewIncludes[view] ||= []
				filePath = Path.join(MODULE_BASE_PATH, module.name, "app/views", partial + ".pug")
				@viewIncludes[view].push pug.compileFile(filePath, doctype: "html")

	moduleIncludes: (view, locals) ->
		compiledPartials = Modules.viewIncludes[view] or []
		html = ""
		for compiledPartial in compiledPartials
			d = new Date()
			html += compiledPartial(locals)
		return html

	moduleIncludesAvailable: (view) ->
		return (Modules.viewIncludes[view] or []).length > 0

	moduleAssetFiles: (pathPrefix) ->
		assetFiles = []
		for module in @modules
			for assetFile in module.assetFiles or []
				assetFiles.push "#{pathPrefix}#{assetFile}"
		return assetFiles

	linkedFileAgentsIncludes: () ->
		agents = {}
		for module in @modules
			for name, agentFunction of module.linkedFileAgents
				agents[name] = agentFunction()
		return agents

	attachHooks: () ->
		for module in @modules
			if module.hooks?
				for hook, method of module.hooks
					Modules.hooks.attach hook, method

	hooks:
		_hooks: {}
		attach: (name, method) ->
			@_hooks[name] ?= []
			@_hooks[name].push method

		fire: (name, args..., callback) ->
			methods = @_hooks[name] or []
			call_methods = methods.map (method) ->
				return (cb) -> method(args..., cb)
			async.series call_methods, (error, results) ->
				return callback(error) if error?
				return callback null, results

Modules.loadModules()

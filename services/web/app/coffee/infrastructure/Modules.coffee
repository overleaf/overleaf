fs   = require "fs"
Path = require "path"
jade = require "jade"
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

	applyRouter: (webRouter, apiRouter) ->
		for module in @modules
			module.router?.apply(webRouter, apiRouter)
			
	viewIncludes: {}
	loadViewIncludes: (app) ->
		@viewIncludes = {}
		for module in @modules
			for view, partial of module.viewIncludes or {}
				@viewIncludes[view] ||= []
				@viewIncludes[view].push fs.readFileSync(Path.join(MODULE_BASE_PATH, module.name, "app/views", partial + ".jade"))
			
	moduleIncludes: (view, locals) ->
		partials = Modules.viewIncludes[view] or []
		html = ""
		for partial in partials
			compiler = jade.compile(partial, doctype: "html")
			html += compiler(locals)
		return html

	moduleIncludesAvailable: (view) ->
		return (Modules.viewIncludes[view] or []).length > 0
	
	attachHooks: () ->
		for module in @modules
			if module.hooks?
				for hook, method of module.hooks
					Modules.hooks.attach hook, method
			
	hooks:
		_hooks: {}
		attach: (name, method) ->
			console.log "attaching hook", name, method
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
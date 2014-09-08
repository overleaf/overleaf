fs   = require "fs"
Path = require "path"
jade = require "jade"

MODULE_BASE_PATH = Path.resolve(__dirname + "/../../../modules")

module.exports = Modules =
	modules: []
	loadModules: () ->
		for moduleName in fs.readdirSync(MODULE_BASE_PATH)
			if fs.existsSync(Path.join(MODULE_BASE_PATH, moduleName, "index.js"))
				loadedModule = require(Path.join(MODULE_BASE_PATH, moduleName, "index"))
				loadedModule.name = moduleName
				@modules.push loadedModule

	applyRouter: (app) ->
		for module in @modules
			module.router?.apply(app)
			
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
			compiler = jade.compile(partial)
			html += compiler(locals)
		return html
		
Modules.loadModules()
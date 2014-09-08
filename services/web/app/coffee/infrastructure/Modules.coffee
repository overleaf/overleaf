fs   = require "fs"
Path = require "path"

MODULE_BASE_PATH = Path.resolve(__dirname + "/../../../modules")

modules = []
for mod in fs.readdirSync(MODULE_BASE_PATH)
	modules.push require(Path.join(MODULE_BASE_PATH, mod, "index"))

module.exports = Modules =
	applyRouter: (app) ->
		for module in modules
			module.router?.apply(app)
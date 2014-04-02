fs = require "fs"
path = require "path"
env = (process.env.NODE_ENV or "development").toLowerCase()

merge = (settings, defaults) ->
	for key, value of settings
		if typeof(value) == "object"
			defaults[key] = merge(settings[key], defaults[key] or {})
		else
			defaults[key] = value
	return defaults

defaultSettingsPath = path.normalize(__dirname + "/../../config/settings.defaults.coffee")

console.log "default settings", defaultSettingsPath
if fs.existsSync(defaultSettingsPath)
	defaults = require(defaultSettingsPath)
	settingsExist = true
else
	defaults = {}
	settingsExist = false

if process.env.SHARELATEX_CONFIG?
	possibleConfigFiles = [process.env.SHARELATEX_CONFIG]
else
	possibleConfigFiles = [
		process.cwd() + "/config/settings.#{env}.coffee"
		path.normalize(__dirname + "/../../config/settings.#{env}.coffee")
	]

for file in possibleConfigFiles
	if fs.existsSync(file)
		module.exports = merge(require(file), defaults)
		settingsExist = true
		break

if !settingsExist
	console.warn "No settings or defaults found. I'm flying blind."

module.exports = defaults

console.log "Settings", module.exports
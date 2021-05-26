fs = require "fs"
path = require "path"
env = (process.env.NODE_ENV or "development").toLowerCase()

merge = (settings, defaults) ->
	for key, value of settings
		if typeof(value) == "object" and value not instanceof Array
			defaults[key] = merge(settings[key], defaults[key] or {})
		else
			defaults[key] = value
	return defaults

defaultSettingsPath = path.normalize(__dirname + "/../../config/settings.defaults")

if fs.existsSync("#{defaultSettingsPath}.js")
	console.log "Using default settings from #{defaultSettingsPath}.js"
	defaults = require("#{defaultSettingsPath}.js")
	settingsExist = true
else if fs.existsSync("#{defaultSettingsPath}.coffee")
	console.warn "CoffeeScript settings file #{defaultSettingsPath}.coffee is deprecated, please convert to JavaScript"
	console.log "Using default settings from #{defaultSettingsPath}.coffee"
	defaults = require("#{defaultSettingsPath}.coffee")
	settingsExist = true
else
	defaults = {}
	settingsExist = false

if process.env.SHARELATEX_CONFIG?
	possibleConfigFiles = [process.env.SHARELATEX_CONFIG]
else
	possibleConfigFiles = [
		process.cwd() + "/config/settings.#{env}.js"
		path.normalize(__dirname + "/../../config/settings.#{env}.js")
		process.cwd() + "/config/settings.#{env}.coffee"
		path.normalize(__dirname + "/../../config/settings.#{env}.coffee")
	]

for file in possibleConfigFiles
	if fs.existsSync(file)
		if file.endsWith('.coffee')
			console.warn "CoffeeScript settings file #{file} is deprecated, please convert to JavaScript"
		console.log "Using settings from " + file
		module.exports = merge(require(file), defaults)
		settingsExist = true
		break

if !settingsExist
	console.warn "No settings or defaults found. I'm flying blind."

module.exports = defaults

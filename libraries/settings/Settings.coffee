fs = require "fs"
path = require "path"
env = (process.env.NODE_ENV or "development").toLowerCase()

possibleConfigFiles = [
	process.cwd() + "/config/settings.#{env}.coffee"
	path.normalize(__dirname + "/../../config/settings.#{env}.coffee")
]

for file in possibleConfigFiles
	if fs.existsSync(file)
		module.exports = require(file)
		return

console.log "No config file could be found at: ", possibleConfigFiles
throw new Error("No config file found")

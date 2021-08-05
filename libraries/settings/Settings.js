let defaults, possibleConfigFiles, settingsExist;
const fs = require("fs");
const path = require("path");
const env = (process.env.NODE_ENV || "development").toLowerCase();
const { merge } = require('./merge');

const defaultSettingsPath = path.normalize(__dirname + "/../../../config/settings.defaults");

if (fs.existsSync(`${defaultSettingsPath}.js`)) {
	console.log(`Using default settings from ${defaultSettingsPath}.js`);
	defaults = require(`${defaultSettingsPath}.js`);
	settingsExist = true;
} else if (fs.existsSync(`${defaultSettingsPath}.coffee`)) {
	// TODO: remove this in the next major version
	throw new Error(`CoffeeScript settings file ${defaultSettingsPath}.coffee is no longer supported, please convert to JavaScript`);
} else {
	defaults = {};
	settingsExist = false;
}

if (process.env.SHARELATEX_CONFIG) {
	possibleConfigFiles = [process.env.SHARELATEX_CONFIG];
} else {
	possibleConfigFiles = [
		process.cwd() + `/config/settings.${env}.js`,
		path.normalize(__dirname + `/../../../config/settings.${env}.js`),
		// TODO: remove these in the next major version
		process.cwd() + `/config/settings.${env}.coffee`,
		path.normalize(__dirname + `/../../../config/settings.${env}.coffee`)
	];
}

for (let file of possibleConfigFiles) {
	if (fs.existsSync(file)) {
		// TODO: remove this in the next major version
		if (file.endsWith('.coffee')) {
			throw new Error(`CoffeeScript settings file ${file} is no longer supported, please convert to JavaScript`);
		}
		console.log("Using settings from " + file);
		module.exports = merge(require(file), defaults);
		settingsExist = true;
		break;
	}
}

if (!settingsExist) {
	console.warn("No settings or defaults found. I'm flying blind.");
}

module.exports = defaults;

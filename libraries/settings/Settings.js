/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let defaults, possibleConfigFiles, settingsExist;
const fs = require("fs");
const path = require("path");
const env = (process.env.NODE_ENV || "development").toLowerCase();

var merge = function(settings, defaults) {
	for (let key in settings) {
		const value = settings[key];
		if ((typeof(value) === "object") && !(value instanceof Array)) {
			defaults[key] = merge(settings[key], defaults[key] || {});
		} else {
			defaults[key] = value;
		}
	}
	return defaults;
};

const defaultSettingsPath = path.normalize(__dirname + "/../../config/settings.defaults");

if (fs.existsSync(`${defaultSettingsPath}.js`)) {
	console.log(`Using default settings from ${defaultSettingsPath}.js`);
	defaults = require(`${defaultSettingsPath}.js`);
	settingsExist = true;
} else if (fs.existsSync(`${defaultSettingsPath}.coffee`)) {
	console.warn(`CoffeeScript settings file ${defaultSettingsPath}.coffee is deprecated, please convert to JavaScript`);
	console.log(`Using default settings from ${defaultSettingsPath}.coffee`);
	defaults = require(`${defaultSettingsPath}.coffee`);
	settingsExist = true;
} else {
	defaults = {};
	settingsExist = false;
}

if (process.env.SHARELATEX_CONFIG != null) {
	possibleConfigFiles = [process.env.SHARELATEX_CONFIG];
} else {
	possibleConfigFiles = [
		process.cwd() + `/config/settings.${env}.js`,
		path.normalize(__dirname + `/../../config/settings.${env}.js`),
		process.cwd() + `/config/settings.${env}.coffee`,
		path.normalize(__dirname + `/../../config/settings.${env}.coffee`)
	];
}

for (let file of Array.from(possibleConfigFiles)) {
	if (fs.existsSync(file)) {
		if (file.endsWith('.coffee')) {
			console.warn(`CoffeeScript settings file ${file} is deprecated, please convert to JavaScript`);
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

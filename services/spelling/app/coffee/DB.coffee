MongoJS = require "mongojs"
Settings = require "settings-sharelatex"
module.exports = MongoJS(Settings.mongo.url, ["spellingPreferences"])


// TODO: This file was created by bulk-decaffeinate.
// Sanity-check the conversion and remove this comment.
const MongoJS = require('mongojs')
const Settings = require('settings-sharelatex')
module.exports = MongoJS(Settings.mongo.url, ['spellingPreferences'])

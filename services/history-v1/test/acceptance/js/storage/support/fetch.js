const BPromise = require('bluebird')
const fetch = require('node-fetch')

fetch.Promise = BPromise

module.exports = fetch

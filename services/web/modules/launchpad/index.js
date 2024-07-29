const LaunchpadRouter = require('./app/src/LaunchpadRouter')

/** @typedef {import("../../types/web-module").WebModule} WebModule */

/** @type {WebModule} */
const LaunchpadModule = {
  router: LaunchpadRouter,
}

module.exports = LaunchpadModule

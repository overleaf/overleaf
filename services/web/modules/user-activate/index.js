const UserActivateRouter = require('./app/src/UserActivateRouter')

/** @typedef {import("../../types/web-module").WebModule} WebModule */

/** @type {WebModule} */
const UserActivateModule = {
  router: UserActivateRouter,
}

module.exports = UserActivateModule

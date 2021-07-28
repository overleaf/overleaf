const AuthenticationController = require('../Authentication/AuthenticationController')
const SessionManager = require('../Authentication/SessionManager')
const ContactController = require('./ContactController')
const Settings = require('@overleaf/settings')

function contactsAuthenticationMiddleware() {
  if (!Settings.allowAnonymousReadAndWriteSharing) {
    return AuthenticationController.requireLogin()
  } else {
    return (req, res, next) => {
      if (SessionManager.isUserLoggedIn(req.session)) {
        next()
      } else {
        res.send({ contacts: [] })
      }
    }
  }
}

module.exports = {
  apply(webRouter) {
    webRouter.get(
      '/user/contacts',
      contactsAuthenticationMiddleware(),
      ContactController.getContacts
    )
  },
}

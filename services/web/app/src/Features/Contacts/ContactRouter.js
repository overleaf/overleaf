const AuthenticationController = require('../Authentication/AuthenticationController')
const ContactController = require('./ContactController')
const Settings = require('settings-sharelatex')

function contactsAuthenticationMiddleware() {
  if (!Settings.allowAnonymousReadAndWriteSharing) {
    return AuthenticationController.requireLogin()
  } else {
    return (req, res, next) => {
      if (AuthenticationController.isUserLoggedIn(req)) {
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
  }
}

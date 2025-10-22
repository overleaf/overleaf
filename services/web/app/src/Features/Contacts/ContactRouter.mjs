import AuthenticationController from '../Authentication/AuthenticationController.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import ContactController from './ContactController.mjs'
import Settings from '@overleaf/settings'

function contactsAuthenticationMiddleware() {
  if (!Settings.allowAnonymousReadAndWriteSharing) {
    return AuthenticationController.requireLogin()
  } else {
    return (req, res, next) => {
      if (SessionManager.isUserLoggedIn(req.session)) {
        next()
      } else {
        res.json({ contacts: [] })
      }
    }
  }
}

export default {
  apply(webRouter) {
    webRouter.get(
      '/user/contacts',
      contactsAuthenticationMiddleware(),
      ContactController.getContacts
    )
  },
}

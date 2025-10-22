import Settings from '@overleaf/settings'
import SessionManager from '../Authentication/SessionManager.mjs'
import SystemMessageManager from './SystemMessageManager.mjs'

const ProjectController = {
  getMessages(req, res, next) {
    if (!SessionManager.isUserLoggedIn(req.session)) {
      // gracefully handle requests from anonymous users
      return res.json([])
    }
    let messages = SystemMessageManager.getMessages()

    if (!Settings.siteIsOpen) {
      // Override all messages with notice for admins when site is closed.
      messages = [
        {
          content:
            'SITE IS CLOSED TO PUBLIC. OPEN ONLY FOR SITE ADMINS. DO NOT EDIT PROJECTS.',
          _id: 'protected', // prevents hiding message in frontend
        },
      ]
    }
    res.json(messages || [])
  },
}

export default ProjectController

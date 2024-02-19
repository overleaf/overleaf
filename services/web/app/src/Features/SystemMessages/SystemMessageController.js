const Settings = require('@overleaf/settings')
const SessionManager = require('../Authentication/SessionManager')
const SystemMessageManager = require('./SystemMessageManager')

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

module.exports = ProjectController

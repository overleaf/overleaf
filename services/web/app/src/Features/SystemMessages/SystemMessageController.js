const Settings = require('settings-sharelatex')
const AuthenticationController = require('../Authentication/AuthenticationController')
const SystemMessageManager = require('./SystemMessageManager')

const ProjectController = {
  getMessages(req, res, next) {
    if (!AuthenticationController.isUserLoggedIn(req)) {
      // gracefully handle requests from anonymous users
      return res.json([])
    }
    SystemMessageManager.getMessages((err, messages) => {
      if (err) {
        next(err)
      } else {
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
      }
    })
  },
}

module.exports = ProjectController

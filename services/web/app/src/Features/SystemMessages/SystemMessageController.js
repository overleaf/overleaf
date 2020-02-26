const Settings = require('settings-sharelatex')
const SystemMessageManager = require('./SystemMessageManager')

const ProjectController = {
  getMessages(req, res, next) {
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
              _id: 'protected' // prevents hiding message in frontend
            }
          ]
        }
        res.json(messages || [])
      }
    })
  }
}

module.exports = ProjectController

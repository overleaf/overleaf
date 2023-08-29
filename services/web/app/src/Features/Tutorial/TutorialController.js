const SessionManager = require('../Authentication/SessionManager')
const TutorialHandler = require('./TutorialHandler')
const { expressify } = require('../../util/promises')

const VALID_KEYS = ['react-history-buttons-tutorial']

async function completeTutorial(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const tutorialKey = req.params.tutorialKey

  if (!VALID_KEYS.includes(tutorialKey)) {
    return res.sendStatus(400)
  }

  await TutorialHandler.saveCompletion(userId, tutorialKey)
  res.sendStatus(204)
}

module.exports = {
  completeTutorial: expressify(completeTutorial),
}

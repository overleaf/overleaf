const SessionManager = require('../Authentication/SessionManager')
const TutorialHandler = require('./TutorialHandler')
const { expressify } = require('@overleaf/promise-utils')

const VALID_KEYS = [
  'react-history-buttons-tutorial',
  'writefull-integration',
  'writefull-oauth-promotion',
  'bib-file-tpr-prompt',
  'ai-error-assistant-consent',
  'code-editor-mode-prompt',
  'history-restore-promo',
]

async function completeTutorial(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const tutorialKey = req.params.tutorialKey

  if (!VALID_KEYS.includes(tutorialKey)) {
    return res.sendStatus(404)
  }

  await TutorialHandler.setTutorialState(userId, tutorialKey, 'completed')
  res.sendStatus(204)
}

async function postponeTutorial(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const tutorialKey = req.params.tutorialKey

  if (!VALID_KEYS.includes(tutorialKey)) {
    return res.sendStatus(404)
  }

  await TutorialHandler.setTutorialState(userId, tutorialKey, 'postponed')
  res.sendStatus(204)
}

module.exports = {
  completeTutorial: expressify(completeTutorial),
  postponeTutorial: expressify(postponeTutorial),
}

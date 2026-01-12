import SessionManager from '../Authentication/SessionManager.mjs'
import TutorialHandler from './TutorialHandler.mjs'
import { expressify } from '@overleaf/promise-utils'

const VALID_KEYS = [
  'react-history-buttons-tutorial',
  'writefull-integration',
  'writefull-oauth-promotion',
  'bib-file-tpr-prompt',
  'ai-error-assistant-consent',
  'workbench-consent',
  'history-restore-promo',
  'us-gov-banner',
  'us-gov-banner-fedramp',
  'editor-popup-ux-survey',
  'wf-features-moved',
  'review-mode',
  'new-error-logs-promo',
  'try-redesign-again-nudge-promo',
  'write-and-cite-nudge-in-linked-file',
  'ide-redesign-new-survey-promo',
  'ide-redesign-beta-intro',
  'ide-redesign-labs-user-beta-promo',
  'rolling-compile-image-changed',
  'groups-enterprise-banner',
  'groups-enterprise-banner-repeat',
  'new-editor-opt-in',
  'new-editor-intro',
  'new-editor-intro-2',
  'old-editor-warning-tooltip',
  'old-editor-warning-tooltip-2',
  'workbench-rail-popover',
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
  let postponedUntil
  if (req.body.postponedUntil) {
    postponedUntil = new Date(req.body.postponedUntil)
  }

  if (!VALID_KEYS.includes(tutorialKey)) {
    return res.sendStatus(404)
  }

  await TutorialHandler.setTutorialState(
    userId,
    tutorialKey,
    'postponed',
    postponedUntil
  )
  res.sendStatus(204)
}

export default {
  completeTutorial: expressify(completeTutorial),
  postponeTutorial: expressify(postponeTutorial),
}

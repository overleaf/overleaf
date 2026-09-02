import SessionManager from '../Authentication/SessionManager.mjs'
import TutorialHandler from './TutorialHandler.mjs'
import { expressify } from '@overleaf/promise-utils'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'

const VALID_KEYS = [
  'react-history-buttons-tutorial',
  'writefull-integration',
  'writefull-oauth-promotion',
  'bib-file-tpr-prompt',
  'ai-error-assistant-consent',
  'workbench-consent',
  'workbench-consent-release',
  'history-restore-promo',
  'us-gov-banner',
  'us-gov-banner-fedramp',
  'editor-popup-ux-survey-03-2026',
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
  'workbench-rail-popover',
  'themed-dashboard-intro',
  'dimensions-consent',
  'dimensions-rail-popover',
  'library-new-badge',
]

// tutorialKey is validated against the same known-key enum the handlers
// also check by hand below. Both the schema and the manual
// VALID_KEYS.includes() guard enforce the same allow-list during this
// rollout's logOnly phase, so an unrecognized key still 404s even while the
// schema failure alone would not throw.
const tutorialKeyParamsSchema = z.strictObject({
  tutorialKey: z.enum(VALID_KEYS),
})

const completeTutorialSchema = z.object({
  params: tutorialKeyParamsSchema,
})

const postponeTutorialSchema = z.object({
  params: tutorialKeyParamsSchema,
  body: z.strictObject({
    postponedUntil: zz.datetime().optional(),
  }),
})

// Rollout-temporary fallback (loosened primary schema; no zod validation
// existed for this route on main); delete when this route's
// REQ_VALIDATION_MODE instrumentation is removed.
const postponeTutorialFallbackSchema = z.object({
  params: z.object({
    tutorialKey: z.enum(VALID_KEYS),
  }),
  body: z.object({
    postponedUntil: z
      .union([z.date(), z.string()])
      .optional()
      .transform(dt =>
        dt === undefined ? undefined : dt instanceof Date ? dt : new Date(dt)
      ),
  }),
})

async function completeTutorial(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { params } = parseReq(req, completeTutorialSchema, {
    logOnly: true,
  })
  const { tutorialKey } = params

  if (!VALID_KEYS.includes(tutorialKey)) {
    return res.sendStatus(404)
  }

  await TutorialHandler.setTutorialState(userId, tutorialKey, 'completed')
  res.sendStatus(204)
}

async function postponeTutorial(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { params, body } = parseReq(req, postponeTutorialSchema, {
    logOnly: true,
    fallbackSchema: postponeTutorialFallbackSchema,
  })
  const { tutorialKey } = params

  if (!VALID_KEYS.includes(tutorialKey)) {
    return res.sendStatus(404)
  }

  let postponedUntil
  if (body.postponedUntil) {
    postponedUntil = new Date(body.postponedUntil)
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

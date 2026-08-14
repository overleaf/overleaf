// @ts-check

import SessionManager from '../Authentication/SessionManager.mjs'
import LearnedWordsManager from './LearnedWordsManager.mjs'
import { z, parseReq } from '../../infrastructure/Validation.mjs'

const learnSchema = z.object({
  body: z.strictObject({
    word: z.string().min(1),
  }),
})
// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const learnFallbackSchema = z.object({
  body: z.object({
    word: z.string().min(1),
  }),
})

const unlearnSchema = z.object({
  body: z.strictObject({
    word: z.string().min(1),
  }),
})
// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const unlearnFallbackSchema = z.object({
  body: z.object({
    word: z.string().min(1),
  }),
})

export default {
  /**
   * @param {any} req
   * @param {any} res
   * @param {any} next
   */
  learn(req, res, next) {
    const { body } = parseReq(req, learnSchema, {
      fallbackSchema: learnFallbackSchema,
    })
    const { word } = body
    const userId = SessionManager.getLoggedInUserId(req.session)
    LearnedWordsManager.learnWord(
      userId,
      word,
      /** @param {any} err */ err => {
        if (err) return next(err)
        res.sendStatus(204)
      }
    )
  },

  /**
   * @param {any} req
   * @param {any} res
   * @param {any} next
   */
  unlearn(req, res, next) {
    const { body } = parseReq(req, unlearnSchema, {
      fallbackSchema: unlearnFallbackSchema,
    })
    const { word } = body
    const userId = SessionManager.getLoggedInUserId(req.session)
    LearnedWordsManager.unlearnWord(
      userId,
      word,
      /** @param {any} err */ err => {
        if (err) return next(err)
        res.sendStatus(204)
      }
    )
  },
}

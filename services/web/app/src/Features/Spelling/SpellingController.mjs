// @ts-check

import SessionManager from '../Authentication/SessionManager.mjs'
import LearnedWordsManager from './LearnedWordsManager.mjs'
import { z, parseReq } from '../../infrastructure/Validation.mjs'

const learnSchema = z.object({
  body: z.object({
    word: z.string().min(1),
  }),
})

const unlearnSchema = z.object({
  body: z.object({
    word: z.string().min(1),
  }),
})

export default {
  learn(req, res, next) {
    const { body } = parseReq(req, learnSchema)
    const { word } = body
    const userId = SessionManager.getLoggedInUserId(req.session)
    LearnedWordsManager.learnWord(userId, word, err => {
      if (err) return next(err)
      res.sendStatus(204)
    })
  },

  unlearn(req, res, next) {
    const { body } = parseReq(req, unlearnSchema)
    const { word } = body
    const userId = SessionManager.getLoggedInUserId(req.session)
    LearnedWordsManager.unlearnWord(userId, word, err => {
      if (err) return next(err)
      res.sendStatus(204)
    })
  },
}

import SessionManager from '../Authentication/SessionManager.js'
import LearnedWordsManager from './LearnedWordsManager.js'

export default {
  learn(req, res, next) {
    const { word } = req.body
    const userId = SessionManager.getLoggedInUserId(req.session)
    LearnedWordsManager.learnWord(userId, word, err => {
      if (err) return next(err)
      res.sendStatus(204)
    })
  },

  unlearn(req, res, next) {
    const { word } = req.body
    const userId = SessionManager.getLoggedInUserId(req.session)
    LearnedWordsManager.unlearnWord(userId, word, err => {
      if (err) return next(err)
      res.sendStatus(204)
    })
  },
}

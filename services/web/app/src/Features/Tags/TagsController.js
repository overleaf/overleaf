const TagsHandler = require('./TagsHandler')
const SessionManager = require('../Authentication/SessionManager')
const Errors = require('../Errors/Errors')

const TagsController = {
  _getTags(userId, _req, res, next) {
    if (!userId) {
      return next(new Errors.NotFoundError())
    }
    TagsHandler.getAllTags(userId, function (error, allTags) {
      if (error != null) {
        return next(error)
      }
      res.json(allTags)
    })
  },

  apiGetAllTags(req, res, next) {
    const { userId } = req.params
    TagsController._getTags(userId, req, res, next)
  },

  getAllTags(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    TagsController._getTags(userId, req, res, next)
  },

  createTag(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const { name } = req.body
    TagsHandler.createTag(userId, name, function (error, tag) {
      if (error != null) {
        return next(error)
      }
      res.json(tag)
    })
  },

  addProjectToTag(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const { tagId, projectId } = req.params
    TagsHandler.addProjectToTag(userId, tagId, projectId, function (error) {
      if (error) {
        return next(error)
      }
      res.status(204).end()
    })
  },

  removeProjectFromTag(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const { tagId, projectId } = req.params
    TagsHandler.removeProjectFromTag(
      userId,
      tagId,
      projectId,
      function (error) {
        if (error) {
          return next(error)
        }
        res.status(204).end()
      }
    )
  },

  deleteTag(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const { tagId } = req.params
    TagsHandler.deleteTag(userId, tagId, function (error) {
      if (error) {
        return next(error)
      }
      res.status(204).end()
    })
  },

  renameTag(req, res, next) {
    const userId = SessionManager.getLoggedInUserId(req.session)
    const { tagId } = req.params
    const name = req.body != null ? req.body.name : undefined
    if (!name) {
      return res.status(400).end()
    }
    TagsHandler.renameTag(userId, tagId, name, function (error) {
      if (error) {
        return next(error)
      }
      res.status(204).end()
    })
  },
}

module.exports = TagsController

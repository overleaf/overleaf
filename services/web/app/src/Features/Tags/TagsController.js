const TagsHandler = require('./TagsHandler')
const SessionManager = require('../Authentication/SessionManager')
const Errors = require('../Errors/Errors')
const { expressify } = require('../../util/promises')

async function _getTags(userId, _req, res) {
  if (!userId) {
    throw new Errors.NotFoundError()
  }
  const allTags = await TagsHandler.promises.getAllTags(userId)
  res.json(allTags)
}

async function apiGetAllTags(req, res) {
  const { userId } = req.params
  await _getTags(userId, req, res)
}

async function getAllTags(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  await _getTags(userId, req, res)
}

async function createTag(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { name } = req.body
  const tag = await TagsHandler.promises.createTag(userId, name)
  res.json(tag)
}

async function addProjectToTag(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { tagId, projectId } = req.params
  await TagsHandler.promises.addProjectToTag(userId, tagId, projectId)
  res.status(204).end()
}

async function removeProjectFromTag(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { tagId, projectId } = req.params
  await TagsHandler.promises.removeProjectFromTag(userId, tagId, projectId)
  res.status(204).end()
}

async function deleteTag(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { tagId } = req.params
  await TagsHandler.promises.deleteTag(userId, tagId)
  res.status(204).end()
}

async function renameTag(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { tagId } = req.params
  const name = req.body?.name
  if (!name) {
    return res.status(400).end()
  }
  await TagsHandler.promises.renameTag(userId, tagId, name)
  res.status(204).end()
}

module.exports = {
  apiGetAllTags: expressify(apiGetAllTags),
  getAllTags: expressify(getAllTags),
  createTag: expressify(createTag),
  addProjectToTag: expressify(addProjectToTag),
  removeProjectFromTag: expressify(removeProjectFromTag),
  deleteTag: expressify(deleteTag),
  renameTag: expressify(renameTag),
}

import TagsHandler from './TagsHandler.js'
import SessionManager from '../Authentication/SessionManager.js'
import Errors from '../Errors/Errors.js'
import { expressify } from '@overleaf/promise-utils'

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
  const { name, color } = req.body
  const tag = await TagsHandler.promises.createTag(userId, name, color)
  res.json(tag)
}

async function addProjectToTag(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { tagId, projectId } = req.params
  await TagsHandler.promises.addProjectToTag(userId, tagId, projectId)
  res.status(204).end()
}

async function addProjectsToTag(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { tagId } = req.params
  const { projectIds } = req.body
  await TagsHandler.promises.addProjectsToTag(userId, tagId, projectIds)
  res.status(204).end()
}

async function removeProjectFromTag(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { tagId, projectId } = req.params
  await TagsHandler.promises.removeProjectFromTag(userId, tagId, projectId)
  res.status(204).end()
}

async function removeProjectsFromTag(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { tagId } = req.params
  const { projectIds } = req.body
  await TagsHandler.promises.removeProjectsFromTag(userId, tagId, projectIds)
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

async function editTag(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { tagId } = req.params
  const name = req.body?.name
  const color = req.body?.color
  if (!name) {
    return res.status(400).end()
  }
  await TagsHandler.promises.editTag(userId, tagId, name, color)
  res.status(204).end()
}

export default {
  apiGetAllTags: expressify(apiGetAllTags),
  getAllTags: expressify(getAllTags),
  createTag: expressify(createTag),
  addProjectToTag: expressify(addProjectToTag),
  addProjectsToTag: expressify(addProjectsToTag),
  removeProjectFromTag: expressify(removeProjectFromTag),
  removeProjectsFromTag: expressify(removeProjectsFromTag),
  deleteTag: expressify(deleteTag),
  renameTag: expressify(renameTag),
  editTag: expressify(editTag),
}

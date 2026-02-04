import TagsHandler from './TagsHandler.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import Errors from '../Errors/Errors.js'
import { z, parseReq } from '../../infrastructure/Validation.mjs'
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

const createTagSchema = z.object({
  body: z.object({
    name: z.string(),
    color: z.string().optional(),
  }),
})

async function createTag(req, res) {
  const { body } = parseReq(req, createTagSchema)
  const { name, color } = body
  const userId = SessionManager.getLoggedInUserId(req.session)
  const tag = await TagsHandler.promises.createTag(userId, name, color)
  res.json(tag)
}

async function addProjectToTag(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { tagId, projectId } = req.params
  await TagsHandler.promises.addProjectToTag(userId, tagId, projectId)
  res.status(204).end()
}

const addProjectsToTagSchema = z.object({
  params: z.object({
    tagId: z.string(),
  }),
  body: z.object({
    projectIds: z.string().array(),
  }),
})

async function addProjectsToTag(req, res) {
  const { params, body } = parseReq(req, addProjectsToTagSchema)
  const { tagId } = params
  const { projectIds } = body
  const userId = SessionManager.getLoggedInUserId(req.session)
  await TagsHandler.promises.addProjectsToTag(userId, tagId, projectIds)
  res.status(204).end()
}

async function removeProjectFromTag(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { tagId, projectId } = req.params
  await TagsHandler.promises.removeProjectFromTag(userId, tagId, projectId)
  res.status(204).end()
}

const removeProjectsFromTagSchema = z.object({
  params: z.object({
    tagId: z.string(),
  }),
  body: z.object({
    projectIds: z.string().array(),
  }),
})

async function removeProjectsFromTag(req, res, next) {
  const { params, body } = parseReq(req, removeProjectsFromTagSchema)
  const { tagId } = params
  const { projectIds } = body
  const userId = SessionManager.getLoggedInUserId(req.session)
  await TagsHandler.promises.removeProjectsFromTag(userId, tagId, projectIds)
  res.status(204).end()
}

async function deleteTag(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { tagId } = req.params
  await TagsHandler.promises.deleteTag(userId, tagId)
  res.status(204).end()
}

const renameTagSchema = z.object({
  params: z.object({
    tagId: z.string(),
  }),
  body: z.object({
    name: z.string(),
  }),
})

async function renameTag(req, res) {
  const { params, body } = parseReq(req, renameTagSchema)
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { tagId } = params
  const name = body.name
  if (!name) {
    return res.status(400).end()
  }
  await TagsHandler.promises.renameTag(userId, tagId, name)
  res.status(204).end()
}

const editTagSchema = z.object({
  params: z.object({
    tagId: z.string(),
  }),
  body: z.object({
    name: z.string(),
    color: z.string().optional(),
  }),
})

async function editTag(req, res) {
  const { params, body } = parseReq(req, editTagSchema)
  const { tagId } = params
  const name = body.name
  const color = body.color
  const userId = SessionManager.getLoggedInUserId(req.session)
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

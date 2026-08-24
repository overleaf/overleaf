import TagsHandler from './TagsHandler.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import Errors from '../Errors/Errors.js'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'
import { expressify } from '@overleaf/promise-utils'
import { TAG_COLOR_REGEX } from '../../models/Tag.mjs'

async function _getTags(userId, _req, res) {
  if (!userId) {
    throw new Errors.NotFoundError()
  }
  const allTags = await TagsHandler.promises.getAllTags(userId)
  res.json(allTags)
}

const apiGetAllTagsSchema = z.object({
  params: z.strictObject({
    userId: zz.objectId(),
  }),
})

async function apiGetAllTags(req, res) {
  const { params } = parseReq(req, apiGetAllTagsSchema, { logOnly: true })
  await _getTags(params.userId, req, res)
}

async function getAllTags(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  await _getTags(userId, req, res)
}

const createTagSchema = z.object({
  body: z.strictObject({
    name: z.string().min(1),
    color: z.string().regex(TAG_COLOR_REGEX).optional(),
  }),
})
// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const createTagFallbackSchema = z.object({
  body: z.object({
    name: z.string(),
    color: z.string().optional(),
  }),
})

async function createTag(req, res) {
  const { body } = parseReq(req, createTagSchema, {
    fallbackSchema: createTagFallbackSchema,
    // TAG_COLOR_REGEX only admits '#rrggbb' or the exact
    // 'hsl(<h>, 70%, 45%)' form the project-list colour picker emits, so log
    // the value to find out what real clients are sending instead.
    logFields: ['body.color'],
  })
  const { name, color } = body
  const userId = SessionManager.getLoggedInUserId(req.session)
  const tag = await TagsHandler.promises.createTag(userId, name, color)
  res.json(tag)
}

const addProjectToTagSchema = z.object({
  params: z.strictObject({
    tagId: zz.objectId(),
    projectId: zz.objectId(),
  }),
})

async function addProjectToTag(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { params } = parseReq(req, addProjectToTagSchema, { logOnly: true })
  const { tagId, projectId } = params
  await TagsHandler.promises.addProjectToTag(userId, tagId, projectId)
  res.status(204).end()
}

const addProjectsToTagSchema = z.object({
  params: z.strictObject({
    tagId: zz.objectId(),
  }),
  body: z.strictObject({
    projectIds: z.array(zz.objectId()),
  }),
})
// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const addProjectsToTagFallbackSchema = z.object({
  params: z.object({
    tagId: z.string(),
  }),
  body: z.object({
    projectIds: z.string().array(),
  }),
})

async function addProjectsToTag(req, res) {
  const { params, body } = parseReq(req, addProjectsToTagSchema, {
    fallbackSchema: addProjectsToTagFallbackSchema,
  })
  const { tagId } = params
  const { projectIds } = body
  const userId = SessionManager.getLoggedInUserId(req.session)
  await TagsHandler.promises.addProjectsToTag(userId, tagId, projectIds)
  res.status(204).end()
}

const removeProjectFromTagSchema = z.object({
  params: z.strictObject({
    tagId: zz.objectId(),
    projectId: zz.objectId(),
  }),
})

async function removeProjectFromTag(req, res, next) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { params } = parseReq(req, removeProjectFromTagSchema, {
    logOnly: true,
  })
  const { tagId, projectId } = params
  await TagsHandler.promises.removeProjectFromTag(userId, tagId, projectId)
  res.status(204).end()
}

const removeProjectsFromTagSchema = z.object({
  params: z.strictObject({
    tagId: zz.objectId(),
  }),
  body: z.strictObject({
    projectIds: z.array(zz.objectId()),
  }),
})
// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const removeProjectsFromTagFallbackSchema = z.object({
  params: z.object({
    tagId: z.string(),
  }),
  body: z.object({
    projectIds: z.string().array(),
  }),
})

async function removeProjectsFromTag(req, res, next) {
  const { params, body } = parseReq(req, removeProjectsFromTagSchema, {
    fallbackSchema: removeProjectsFromTagFallbackSchema,
  })
  const { tagId } = params
  const { projectIds } = body
  const userId = SessionManager.getLoggedInUserId(req.session)
  await TagsHandler.promises.removeProjectsFromTag(userId, tagId, projectIds)
  res.status(204).end()
}

const deleteTagSchema = z.object({
  params: z.strictObject({
    tagId: zz.objectId(),
  }),
})

async function deleteTag(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { params } = parseReq(req, deleteTagSchema, { logOnly: true })
  const { tagId } = params
  await TagsHandler.promises.deleteTag(userId, tagId)
  res.status(204).end()
}

const renameTagSchema = z.object({
  params: z.strictObject({
    tagId: zz.objectId(),
  }),
  body: z.strictObject({
    name: z.string().min(1),
  }),
})
// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const renameTagFallbackSchema = z.object({
  params: z.object({
    tagId: z.string(),
  }),
  body: z.object({
    name: z.string(),
  }),
})

async function renameTag(req, res) {
  const { params, body } = parseReq(req, renameTagSchema, {
    fallbackSchema: renameTagFallbackSchema,
  })
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { tagId } = params
  const { name } = body
  if (!name) {
    return res.status(400).end()
  }
  await TagsHandler.promises.renameTag(userId, tagId, name)
  res.status(204).end()
}

const editTagSchema = z.object({
  params: z.strictObject({
    tagId: zz.objectId(),
  }),
  body: z.strictObject({
    name: z.string().min(1),
    color: z.string().regex(TAG_COLOR_REGEX).optional(),
  }),
})
// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const editTagFallbackSchema = z.object({
  params: z.object({
    tagId: z.string(),
  }),
  body: z.object({
    name: z.string(),
    color: z.string().optional(),
  }),
})

async function editTag(req, res) {
  const { params, body } = parseReq(req, editTagSchema, {
    fallbackSchema: editTagFallbackSchema,
    // same unknown as createTag above
    logFields: ['body.color'],
  })
  const { tagId } = params
  const { name, color } = body
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

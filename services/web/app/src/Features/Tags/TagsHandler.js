const { Tag } = require('../../models/Tag')
const { callbackify } = require('../../util/promises')

const MAX_TAG_LENGTH = 50

async function getAllTags(userId) {
  return Tag.find({ user_id: userId })
}

async function createTag(userId, name, color, options = {}) {
  if (name.length > MAX_TAG_LENGTH) {
    if (options.truncate) {
      name = name.slice(0, MAX_TAG_LENGTH)
    } else {
      throw new Error('Exceeded max tag length')
    }
  }
  try {
    return await Tag.create({ user_id: userId, name, color })
  } catch (error) {
    // on duplicate key error return existing tag
    if (error && error.code === 11000) {
      return Tag.findOne({ user_id: userId, name })
    }
    throw error
  }
}

async function renameTag(userId, tagId, name) {
  if (name.length > MAX_TAG_LENGTH) {
    throw new Error('Exceeded max tag length')
  }
  return Tag.updateOne(
    {
      _id: tagId,
      user_id: userId,
    },
    {
      $set: {
        name,
      },
    }
  )
}

async function editTag(userId, tagId, name, color) {
  if (name.length > MAX_TAG_LENGTH) {
    throw new Error('Exceeded max tag length')
  }
  return Tag.updateOne(
    {
      _id: tagId,
      user_id: userId,
    },
    {
      $set: {
        name,
        color,
      },
    }
  )
}

async function deleteTag(userId, tagId) {
  await Tag.deleteOne({
    _id: tagId,
    user_id: userId,
  })
}

async function removeProjectFromTag(userId, tagId, projectId) {
  const searchOps = {
    _id: tagId,
    user_id: userId,
  }
  const deleteOperation = { $pull: { project_ids: projectId } }
  await Tag.updateOne(searchOps, deleteOperation)
}

async function removeProjectsFromTag(userId, tagId, projectIds) {
  const searchOps = {
    _id: tagId,
    user_id: userId,
  }
  const deleteOperation = { $pullAll: { project_ids: projectIds } }
  await Tag.updateOne(searchOps, deleteOperation)
}

async function addProjectToTag(userId, tagId, projectId) {
  const searchOps = {
    _id: tagId,
    user_id: userId,
  }
  const insertOperation = { $addToSet: { project_ids: projectId } }
  return Tag.findOneAndUpdate(searchOps, insertOperation)
}

async function addProjectsToTag(userId, tagId, projectIds) {
  const searchOps = {
    _id: tagId,
    user_id: userId,
  }
  const insertOperation = { $addToSet: { project_ids: { $each: projectIds } } }
  await Tag.findOneAndUpdate(searchOps, insertOperation)
}

async function addProjectToTagName(userId, name, projectId) {
  const searchOps = {
    name,
    user_id: userId,
  }
  const insertOperation = { $addToSet: { project_ids: projectId } }
  await Tag.updateOne(searchOps, insertOperation, { upsert: true })
}

async function removeProjectFromAllTags(userId, projectId) {
  const searchOps = { user_id: userId }
  const deleteOperation = { $pull: { project_ids: projectId } }
  await Tag.updateMany(searchOps, deleteOperation)
}

module.exports = {
  getAllTags: callbackify(getAllTags),
  createTag: callbackify(createTag),
  renameTag: callbackify(renameTag),
  editTag: callbackify(editTag),
  deleteTag: callbackify(deleteTag),
  addProjectToTag: callbackify(addProjectToTag),
  addProjectsToTag: callbackify(addProjectsToTag),
  removeProjectFromTag: callbackify(removeProjectFromTag),
  removeProjectsFromTag: callbackify(removeProjectsFromTag),
  addProjectToTagName: callbackify(addProjectToTagName),
  removeProjectFromAllTags: callbackify(removeProjectFromAllTags),
  promises: {
    getAllTags,
    createTag,
    renameTag,
    editTag,
    deleteTag,
    addProjectToTag,
    addProjectsToTag,
    removeProjectFromTag,
    removeProjectsFromTag,
    addProjectToTagName,
    removeProjectFromAllTags,
  },
}

const { Tag } = require('../../models/Tag')
const { promisifyAll } = require('../../util/promises')

const MAX_TAG_LENGTH = 50

function getAllTags(userId, callback) {
  Tag.find({ user_id: userId }, callback)
}

function createTag(userId, name, color, callback) {
  if (!callback) {
    callback = function () {}
  }
  if (name.length > MAX_TAG_LENGTH) {
    return callback(new Error('Exceeded max tag length'))
  }
  Tag.create({ user_id: userId, name, color }, function (err, tag) {
    // on duplicate key error return existing tag
    if (err && err.code === 11000) {
      return Tag.findOne({ user_id: userId, name }, callback)
    }
    callback(err, tag)
  })
}

function renameTag(userId, tagId, name, callback) {
  if (!callback) {
    callback = function () {}
  }
  if (name.length > MAX_TAG_LENGTH) {
    return callback(new Error('Exceeded max tag length'))
  }
  Tag.updateOne(
    {
      _id: tagId,
      user_id: userId,
    },
    {
      $set: {
        name,
      },
    },
    callback
  )
}

function editTag(userId, tagId, name, color, callback) {
  if (name.length > MAX_TAG_LENGTH) {
    return callback(new Error('Exceeded max tag length'))
  }
  Tag.updateOne(
    {
      _id: tagId,
      user_id: userId,
    },
    {
      $set: {
        name,
        color,
      },
    },
    callback
  )
}

function deleteTag(userId, tagId, callback) {
  if (!callback) {
    callback = function () {}
  }
  Tag.deleteOne(
    {
      _id: tagId,
      user_id: userId,
    },
    callback
  )
}

// TODO: unused?
function updateTagUserIds(oldUserId, newUserId, callback) {
  if (!callback) {
    callback = function () {}
  }
  const searchOps = { user_id: oldUserId }
  const updateOperation = { $set: { user_id: newUserId } }
  Tag.updateMany(searchOps, updateOperation, callback)
}

function removeProjectFromTag(userId, tagId, projectId, callback) {
  if (!callback) {
    callback = function () {}
  }
  const searchOps = {
    _id: tagId,
    user_id: userId,
  }
  const deleteOperation = { $pull: { project_ids: projectId } }
  Tag.updateOne(searchOps, deleteOperation, callback)
}

function removeProjectsFromTag(userId, tagId, projectIds, callback) {
  if (!callback) {
    callback = function () {}
  }
  const searchOps = {
    _id: tagId,
    user_id: userId,
  }
  const deleteOperation = { $pullAll: { project_ids: projectIds } }
  Tag.updateOne(searchOps, deleteOperation, callback)
}

function addProjectToTag(userId, tagId, projectId, callback) {
  if (!callback) {
    callback = function () {}
  }
  const searchOps = {
    _id: tagId,
    user_id: userId,
  }
  const insertOperation = { $addToSet: { project_ids: projectId } }
  Tag.findOneAndUpdate(searchOps, insertOperation, callback)
}

function addProjectsToTag(userId, tagId, projectIds, callback) {
  if (!callback) {
    callback = function () {}
  }
  const searchOps = {
    _id: tagId,
    user_id: userId,
  }
  const insertOperation = { $addToSet: { project_ids: { $each: projectIds } } }
  Tag.findOneAndUpdate(searchOps, insertOperation, callback)
}

function addProjectToTagName(userId, name, projectId, callback) {
  if (!callback) {
    callback = function () {}
  }
  const searchOps = {
    name,
    user_id: userId,
  }
  const insertOperation = { $addToSet: { project_ids: projectId } }
  Tag.updateOne(searchOps, insertOperation, { upsert: true }, callback)
}

function removeProjectFromAllTags(userId, projectId, callback) {
  const searchOps = { user_id: userId }
  const deleteOperation = { $pull: { project_ids: projectId } }
  Tag.updateMany(searchOps, deleteOperation, callback)
}

const TagsHandler = {
  getAllTags,
  createTag,
  renameTag,
  editTag,
  deleteTag,
  updateTagUserIds,
  addProjectToTag,
  addProjectsToTag,
  removeProjectFromTag,
  removeProjectsFromTag,
  addProjectToTagName,
  removeProjectFromAllTags,
}
TagsHandler.promises = promisifyAll(TagsHandler)
module.exports = TagsHandler

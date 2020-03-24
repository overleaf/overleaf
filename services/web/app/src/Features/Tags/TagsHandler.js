const { Tag } = require('../../models/Tag')
const { promisifyAll } = require('../../util/promises')

function getAllTags(userId, callback) {
  Tag.find({ user_id: userId }, callback)
}

function createTag(userId, name, callback) {
  if (!callback) {
    callback = function() {}
  }
  Tag.create({ user_id: userId, name }, function(err, tag) {
    // on duplicate key error return existing tag
    if (err && err.code === 11000) {
      return Tag.findOne({ user_id: userId, name }, callback)
    }
    callback(err, tag)
  })
}

function renameTag(userId, tagId, name, callback) {
  if (!callback) {
    callback = function() {}
  }
  Tag.update(
    {
      _id: tagId,
      user_id: userId
    },
    {
      $set: {
        name
      }
    },
    callback
  )
}

function deleteTag(userId, tagId, callback) {
  if (!callback) {
    callback = function() {}
  }
  Tag.remove(
    {
      _id: tagId,
      user_id: userId
    },
    callback
  )
}

// TODO: unused?
function updateTagUserIds(oldUserId, newUserId, callback) {
  if (!callback) {
    callback = function() {}
  }
  const searchOps = { user_id: oldUserId }
  const updateOperation = { $set: { user_id: newUserId } }
  Tag.update(searchOps, updateOperation, { multi: true }, callback)
}

function removeProjectFromTag(userId, tagId, projectId, callback) {
  if (!callback) {
    callback = function() {}
  }
  const searchOps = {
    _id: tagId,
    user_id: userId
  }
  const deleteOperation = { $pull: { project_ids: projectId } }
  Tag.update(searchOps, deleteOperation, callback)
}

function addProjectToTag(userId, tagId, projectId, callback) {
  if (!callback) {
    callback = function() {}
  }
  const searchOps = {
    _id: tagId,
    user_id: userId
  }
  const insertOperation = { $addToSet: { project_ids: projectId } }
  Tag.findOneAndUpdate(searchOps, insertOperation, callback)
}

function addProjectToTagName(userId, name, projectId, callback) {
  if (!callback) {
    callback = function() {}
  }
  const searchOps = {
    name,
    user_id: userId
  }
  const insertOperation = { $addToSet: { project_ids: projectId } }
  Tag.update(searchOps, insertOperation, { upsert: true }, callback)
}

function removeProjectFromAllTags(userId, projectId, callback) {
  const searchOps = { user_id: userId }
  const deleteOperation = { $pull: { project_ids: projectId } }
  Tag.update(searchOps, deleteOperation, { multi: true }, callback)
}

const TagsHandler = {
  getAllTags,
  createTag,
  renameTag,
  deleteTag,
  updateTagUserIds,
  removeProjectFromTag,
  addProjectToTag,
  addProjectToTagName,
  removeProjectFromAllTags
}
TagsHandler.promises = promisifyAll(TagsHandler)
module.exports = TagsHandler

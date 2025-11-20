import OError from '@overleaf/o-error'
import mongodb from 'mongodb-legacy'
import { ObjectId as MongooseObjectId } from 'mongoose'

const { ObjectId } = mongodb

function _getObjectIdInstance(id) {
  if (typeof id === 'string') {
    return new ObjectId(id)
  } else if (id instanceof ObjectId) {
    return id
  } else if (id instanceof MongooseObjectId) {
    return new ObjectId(id.toString())
  } else {
    throw new OError('unexpected object id', { id })
  }
}

function normalizeQuery(query) {
  if (!query) {
    throw new Error('no query provided')
  }
  if (
    typeof query === 'string' ||
    query instanceof ObjectId ||
    query instanceof MongooseObjectId
  ) {
    return { _id: _getObjectIdInstance(query) }
  } else if (typeof query._id === 'string') {
    query._id = new ObjectId(query._id)
    return query
  } else {
    return query
  }
}

function normalizeMultiQuery(query) {
  if (query instanceof Set) {
    query = Array.from(query)
  }
  if (Array.isArray(query)) {
    return { _id: { $in: query.map(id => _getObjectIdInstance(id)) } }
  } else {
    return normalizeQuery(query)
  }
}

function isObjectIdInstance(id) {
  return id instanceof ObjectId || id instanceof MongooseObjectId
}

export default {
  isObjectIdInstance,
  normalizeQuery,
  normalizeMultiQuery,
}

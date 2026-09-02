import settings from '@overleaf/settings'
import projectKey from '@overleaf/object-persistor/src/ProjectKey.js'
import { parseReq } from '@overleaf/validation-tools'
import {
  bucketFileParamsSchema,
  globalBlobFileParamsSchema,
  projectBlobFileParamsSchema,
  projectBlobFileParamsFallbackSchema,
  templateFileParamsSchema,
  templateFileParamsFallbackSchema,
} from './schemas.js'

export default {
  getConvertedFolderKey,
  addCachingToKey,
  bucketFileKeyMiddleware,
  globalBlobFileKeyMiddleware,
  projectBlobFileKeyMiddleware,
  templateFileKeyMiddleware,
}

function getConvertedFolderKey(key) {
  return `${key}-converted-cache/`
}

function addCachingToKey(key, opts) {
  key = this.getConvertedFolderKey(key)

  if (opts.format && !opts.style) {
    key = `${key}format-${opts.format}`
  }
  if (opts.style && !opts.format) {
    key = `${key}style-${opts.style}`
  }
  if (opts.style && opts.format) {
    key = `${key}format-${opts.format}-style-${opts.style}`
  }

  return key
}

function bucketFileKeyMiddleware(req, res, next) {
  const { params } = parseReq(req, bucketFileParamsSchema, {
    logOnly: true,
  })
  req.bucket = params.bucket
  req.key = params.key
  next()
}

function globalBlobFileKeyMiddleware(req, res, next) {
  const { params } = parseReq(req, globalBlobFileParamsSchema, {
    logOnly: true,
  })
  req.bucket = settings.filestore.stores.global_blobs
  const { hash } = params
  req.key = `${hash.slice(0, 2)}/${hash.slice(2, 4)}/${hash.slice(4)}`
  req.useSubdirectories = true
  next()
}

function projectBlobFileKeyMiddleware(req, res, next) {
  const { params } = parseReq(req, projectBlobFileParamsSchema, {
    logOnly: true,
    fallbackSchema: projectBlobFileParamsFallbackSchema,
  })
  req.bucket = settings.filestore.stores.project_blobs
  const { historyId, hash } = params
  req.key = `${projectKey.format(historyId)}/${hash.slice(0, 2)}/${hash.slice(2)}`
  req.useSubdirectories = true
  next()
}

function templateFileKeyMiddleware(req, res, next) {
  const { params } = parseReq(req, templateFileParamsSchema, {
    logOnly: true,
    fallbackSchema: templateFileParamsFallbackSchema,
  })
  const { template_id: templateId, format, version, sub_type: subType } = params

  req.key = `${templateId}/v/${version}/${format}`

  if (subType) {
    req.key = `${req.key}/${subType}`
  }

  req.bucket = settings.filestore.stores.template_files
  req.version = version

  next()
}

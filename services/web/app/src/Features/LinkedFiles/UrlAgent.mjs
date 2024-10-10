import logger from '@overleaf/logger'
import urlValidator from 'valid-url'
import { InvalidUrlError, UrlFetchFailedError } from './LinkedFilesErrors.js'
import LinkedFilesHandler from './LinkedFilesHandler.js'
import UrlHelper from '../Helpers/UrlHelper.js'
import { fetchStream, RequestFailedError } from '@overleaf/fetch-utils'
import { callbackify } from '@overleaf/promise-utils'
import { FileTooLargeError } from '../Errors/Errors.js'

async function createLinkedFile(
  projectId,
  linkedFileData,
  name,
  parentFolderId,
  userId
) {
  logger.info(
    { projectId, userId, url: linkedFileData.url },
    'create linked file'
  )
  linkedFileData = _sanitizeData(linkedFileData)
  const fetchUrl = _getUrl(projectId, linkedFileData, userId)
  try {
    const readStream = await fetchStream(fetchUrl)
    const file = await LinkedFilesHandler.promises.importFromStream(
      projectId,
      readStream,
      linkedFileData,
      name,
      parentFolderId,
      userId
    )
    return file._id
  } catch (error) {
    if (error instanceof RequestFailedError && /too large/.test(error.body)) {
      throw new FileTooLargeError('file too large', {
        url: linkedFileData.url,
      }).withCause(error)
    }
    throw new UrlFetchFailedError('url fetch failed', {
      url: linkedFileData.url,
    }).withCause(error)
  }
}

async function refreshLinkedFile(
  projectId,
  linkedFileData,
  name,
  parentFolderId,
  userId
) {
  return await createLinkedFile(
    projectId,
    linkedFileData,
    name,
    parentFolderId,
    userId
  )
}

function _sanitizeData(data) {
  return {
    provider: data.provider,
    url: UrlHelper.prependHttpIfNeeded(data.url),
    importedAt: data.importedAt,
  }
}

function _getUrl(projectId, data, currentUserId) {
  let { url } = data
  if (!urlValidator.isWebUri(url)) {
    throw new InvalidUrlError(`invalid url: ${url}`)
  }
  url = UrlHelper.wrapUrlWithProxy(url)
  return url
}

export default {
  createLinkedFile: callbackify(createLinkedFile),
  refreshLinkedFile: callbackify(refreshLinkedFile),
  promises: { createLinkedFile, refreshLinkedFile },
}

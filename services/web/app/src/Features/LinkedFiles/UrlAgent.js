const logger = require('@overleaf/logger')
const urlValidator = require('valid-url')
const { InvalidUrlError, UrlFetchFailedError } = require('./LinkedFilesErrors')
const LinkedFilesHandler = require('./LinkedFilesHandler')
const UrlHelper = require('../Helpers/UrlHelper')
const { fetchStream, RequestFailedError } = require('@overleaf/fetch-utils')
const { callbackify } = require('@overleaf/promise-utils')
const { FileTooLargeError } = require('../Errors/Errors')

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

module.exports = {
  createLinkedFile: callbackify(createLinkedFile),
  refreshLinkedFile: callbackify(refreshLinkedFile),
  promises: { createLinkedFile, refreshLinkedFile },
}

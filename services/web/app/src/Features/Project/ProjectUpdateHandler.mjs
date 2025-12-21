import { Project } from '../../models/Project.mjs'
import { callbackify } from 'node:util'
import OError from '@overleaf/o-error'
import { createClient } from 'webdav'
import ProjectWebDAVAutoSync from './ProjectWebDAVAutoSync.mjs'

const ProjectUpdateHandler = {
  async markAsUpdated(projectId, lastUpdatedAt, lastUpdatedBy) {
    if (!lastUpdatedAt) {
      lastUpdatedAt = new Date()
    }

    const conditions = {
      _id: projectId,
      lastUpdated: { $lt: lastUpdatedAt },
    }

    const update = {
      lastUpdated: lastUpdatedAt || new Date().getTime(),
      lastUpdatedBy,
    }
    await Project.updateOne(conditions, update, {}).exec()

    // Trigger automatic WebDAV sync check (runs in background)
    ProjectWebDAVAutoSync.markPendingSync(projectId, false).catch(err => {
      // Ignore errors - this is a best-effort background operation
    })
  },

  async markAsOpened(projectId) {
    const conditions = { _id: projectId }
    const update = { lastOpened: Date.now() }
    await Project.updateOne(conditions, update, {}).exec()
  },

  async markAsInactive(projectId) {
    const conditions = { _id: projectId }
    const update = { active: false }
    await Project.updateOne(conditions, update, {}).exec()
  },

  async markAsActive(projectId) {
    const conditions = { _id: projectId }
    const update = { active: true }
    await Project.updateOne(conditions, update, {}).exec()
  },

  async setWebDAVConfig(projectId, webdavConfig) {
    const basePath = (webdavConfig.basePath || '/overleaf').replace(/\/$/, '')
    
    // Get current config to check if this is a new link or an update
    const project = await Project.findById(projectId, 'webdavConfig').exec()
    const currentConfig = project?.webdavConfig
    const isBasePathChanged = !currentConfig || currentConfig.basePath !== basePath
    
    // Determine final credential values based on useUsername/usePassword flags
    // If enabled but empty, preserve existing value; if disabled, clear it
    let finalUsername = ''
    let finalPassword = ''
    
    if (webdavConfig.useUsername) {
      // If username field is provided and not empty, use it
      // Otherwise preserve existing username
      finalUsername = webdavConfig.username || currentConfig?.username || ''
    }
    
    if (webdavConfig.usePassword) {
      // If password field is provided and not empty, use it
      // Otherwise preserve existing password
      finalPassword = webdavConfig.password || currentConfig?.password || ''
    }
    
    // Create WebDAV client to check connection and directory
    const client = createClient(webdavConfig.url, {
      username: finalUsername,
      password: finalPassword,
    })

    try {
      // Only check if directory is empty when basePath has changed
      // (i.e., this is a new link or changing to a different directory)
      if (isBasePathChanged) {
        const exists = await client.exists(basePath)
        if (exists) {
          const contents = await client.getDirectoryContents(basePath)
          if (contents.length > 0) {
            throw new OError('WebDAV directory is not empty', {
              public: { message: 'webdav_directory_not_empty' },
            })
          }
        }
      } else {
        // Just verify connection when only updating credentials
        await client.exists(basePath)
      }
    } catch (err) {
      if (err.info?.public?.message === 'webdav_directory_not_empty') {
        throw err
      }
      throw new OError('failed to connect to webdav', {
        cause: err,
        public: { message: 'webdav_connection_failed' },
      })
    }

    const conditions = { _id: projectId }
    const update = {
      webdavConfig: {
        url: webdavConfig.url,
        username: finalUsername,
        password: finalPassword,
        basePath: basePath,
        enabled: true,
        // Only reset sync information when basePath changes
        lastSyncDate: isBasePathChanged ? null : (currentConfig?.lastSyncDate || null),
        syncedFileHashes: isBasePathChanged ? {} : (currentConfig?.syncedFileHashes || {}),
      },
    }
    await Project.updateOne(conditions, update, {}).exec()
  },

  async unsetWebDAVConfig(projectId) {
    const conditions = { _id: projectId }
    const update = {
      $unset: {
        webdavConfig: '',
      },
    }
    await Project.updateOne(conditions, update, {}).exec()
  },
}

export default {
  markAsUpdated: callbackify(ProjectUpdateHandler.markAsUpdated),
  markAsOpened: callbackify(ProjectUpdateHandler.markAsOpened),
  markAsInactive: callbackify(ProjectUpdateHandler.markAsInactive),
  markAsActive: callbackify(ProjectUpdateHandler.markAsActive),
  setWebDAVConfig: callbackify(ProjectUpdateHandler.setWebDAVConfig),
  unsetWebDAVConfig: callbackify(ProjectUpdateHandler.unsetWebDAVConfig),
  promises: ProjectUpdateHandler,
}

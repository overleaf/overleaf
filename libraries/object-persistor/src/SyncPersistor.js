const AbstractPersistor = require('./AbstractPersistor')
const PersistorHelper = require('./PersistorHelper')
const { WriteError } = require('./Errors')
const Logger = require('@overleaf/logger')

console.error(' [SyncPersistor] Module Loaded')

module.exports = class SyncPersistor extends AbstractPersistor {
    constructor(primaryPersistor, configProvider) {
        super()
        this.primary = primaryPersistor
        this.configProvider = configProvider
        this.webdavPersistors = new Map() // Cache persistors by projectId
    }


    async getSyncPersistor(location, name) {
        console.error(` [SyncPersistor] getSyncPersistor location=${location} name=${name}`)
        let projectId = null

        // Check if it's a valid 24-character MongoDB ObjectId
        const isObjectId = key => /^[0-9a-f]{24}$/i.test(key)

        // In filestore, location is the bucket name (e.g. 'filestore').
        // The projectId is part of the key (name), e.g. 'projectId/fileId'.
        if (isObjectId(location)) {
            projectId = location
        } else if (name) {
            const parts = name.split('/')

            // Check if first part is an ObjectId (filestore format: projectId/fileId)
            if (parts.length > 0 && isObjectId(parts[0])) {
                projectId = parts[0]
            }
            // Check for history-v1 format: abc/def/ghijklmnopqrstuvwx/XY/hash
            // The first 3 parts form a reversed project key that needs to be reversed back
            else if (parts.length >= 3) {
                // For MongoDB ObjectId projects in history-v1, the format is:
                // f87/37e/8357fadce1f4886496/... where each part is part of reversed ObjectId
                const reversedPrefix = parts[0] + parts[1] + parts[2]
                // Reverse it back
                const potentialProjectId = reversedPrefix.split('').reverse().join('')
                console.error(` [SyncPersistor] Trying to extract projectId from history-v1 format: reversed=${reversedPrefix} -> potential=${potentialProjectId}`)

                if (isObjectId(potentialProjectId)) {
                    projectId = potentialProjectId
                }
            }
        }

        console.error(` [SyncPersistor] Extracted projectId=${projectId}`)

        if (!projectId || !isObjectId(projectId)) {
            // If we can't determine the project ID, we can't sync.
            console.error(` [SyncPersistor] Cannot determine projectId, skipping sync`)
            return null
        }

        if (this.webdavPersistors.has(projectId)) {
            return this.webdavPersistors.get(projectId)
        }

        try {
            Logger.info({ location, projectId, name }, 'checking webdav config for project')
            const config = await this.configProvider.getWebDAVConfig(projectId)
            console.error(` [SyncPersistor] WebDAV config for ${projectId}: ${JSON.stringify(config)}`)
            Logger.info({ location, projectId, config }, 'got webdav config')
            if (config && config.url && config.enabled) {
                const WebDAVPersistor = require('./WebDAVPersistor')
                const persistor = new WebDAVPersistor(config)
                this.webdavPersistors.set(projectId, persistor)
                Logger.info({ projectId }, 'initialized WebDAV persistor')
                console.error(` [SyncPersistor] WebDAV persistor initialized for ${projectId}`)
                return persistor
            } else {
                console.error(` [SyncPersistor] WebDAV config not enabled or missing: enabled=${config?.enabled}, url=${config?.url}`)
            }
        } catch (err) {
            console.error(` [SyncPersistor] Error getting webdav config: ${err.message}`)
            Logger.warn({ err, location, projectId }, 'failed to get project webdav config')
        }
        return null
    }


    async sendFile(location, target, source) {
        // Note: Automatic sync to WebDAV is disabled here.
        // User-friendly file syncing is handled by ProjectWebDAVSync service.
        await this.primary.sendFile(location, target, source)
    }

    async sendStream(location, target, sourceStream, opts = {}) {
        // Note: Automatic sync to WebDAV is disabled here.
        // User-friendly file syncing is handled by ProjectWebDAVSync service.
        await this.primary.sendStream(location, target, sourceStream, opts)
    }

    async getObjectStream(location, name, opts = {}) {
        // Note: Automatic sync is disabled here.
        // User-friendly file syncing is handled by ProjectWebDAVSync service.
        return this.primary.getObjectStream(location, name, opts)
    }

    async getRedirectUrl(location, name) {
        return this.primary.getRedirectUrl(location, name)
    }

    async getObjectSize(location, name, opts) {
        return this.primary.getObjectSize(location, name, opts)
    }

    async getObjectMd5Hash(location, name, opts) {
        return this.primary.getObjectMd5Hash(location, name, opts)
    }

    async copyObject(location, fromName, toName, opts) {
        await this.primary.copyObject(location, fromName, toName, opts)
        this._syncToRemote(location, toName).catch(err => {
            Logger.warn(
                { err, location, fromName, toName },
                'background sync to remote failed'
            )
        })
    }

    async deleteObject(location, name) {
        await this.primary.deleteObject(location, name)
        try {
            const sync = await this.getSyncPersistor(location, name)
            if (sync) {
                const remotePath = this._getSimplifiedRemotePath(location, name)
                await sync.deleteObject('sync', remotePath)
            }
        } catch (err) {
            Logger.warn({ err, location, name }, 'background delete from sync failed')
        }
    }

    async deleteDirectory(location, name, continuationToken) {
        await this.primary.deleteDirectory(location, name, continuationToken)
        try {
            const sync = await this.getSyncPersistor(location, name)
            if (sync) {
                await sync.deleteDirectory(location, name, continuationToken)
            }
        } catch (err) {
            Logger.warn({ err, location, name }, 'background delete from sync failed')
        }
    }

    async checkIfObjectExists(location, name, opts) {
        return this.primary.checkIfObjectExists(location, name, opts)
    }

    async directorySize(location, name, continuationToken) {
        return this.primary.directorySize(location, name, continuationToken)
    }

    async listDirectoryKeys(location, prefix) {
        return this.primary.listDirectoryKeys(location, prefix)
    }

    async listDirectoryStats(location, prefix) {
        return this.primary.listDirectoryStats(location, prefix)
    }

    async getObjectMetadata(location, name) {
        return this.primary.getObjectMetadata(location, name)
    }


    async _syncToRemote(location, name) {
        Logger.info({ location, name }, '_syncToRemote called')
        const sync = await this.getSyncPersistor(location, name)
        if (!sync) return

        try {
            const remotePath = this._getSimplifiedRemotePath(location, name)
            Logger.info({ location, name, remotePath }, '_syncToRemote using simplified path')

            const stream = await this.primary.getObjectStream(location, name)
            // Use 'sync' as a simple bucket name, and the remotePath as the key
            await sync.sendStream('sync', remotePath, stream)
            Logger.info({ location, name, remotePath }, '_syncToRemote success')
        } catch (err) {
            throw PersistorHelper.wrapError(
                err,
                'failed to sync to remote',
                { location, name },
                WriteError
            )
        }
    }

    // Helper method to extract projectId from location/name
    _extractProjectId(location, name) {
        const isObjectId = key => /^[0-9a-f]{24}$/i.test(key)

        if (isObjectId(location)) {
            return location
        }

        if (name) {
            const parts = name.split('/')

            // Check if first part is an ObjectId (filestore format: projectId/fileId)
            if (parts.length > 0 && isObjectId(parts[0])) {
                return parts[0]
            }
            // Check for history-v1 format: abc/def/ghijklmnopqrstuvwx/...
            else if (parts.length >= 3) {
                const reversedPrefix = parts[0] + parts[1] + parts[2]
                const potentialProjectId = reversedPrefix.split('').reverse().join('')
                if (isObjectId(potentialProjectId)) {
                    return potentialProjectId
                }
            }
        }
        return null
    }

    // Helper method to build a simplified remote path for WebDAV
    _getSimplifiedRemotePath(location, name) {
        const projectId = this._extractProjectId(location, name)
        if (!projectId) {
            return name
        }

        // Determine the type of storage based on location
        let storageType = 'files'
        if (location.includes('history') || location.includes('chunks')) {
            storageType = 'history'
        } else if (location.includes('blobs')) {
            storageType = 'blobs'
        }

        // Extract just the filename part (last component after the projectId path)
        const parts = name.split('/')
        // For history-v1 format: f87/37e/8357fadce1f4886496/chunkId
        // We want to use just the chunkId as the filename
        const filename = parts.length > 3 ? parts.slice(3).join('/') : parts[parts.length - 1]

        // Build simplified path: storageType/projectId/filename
        return `${storageType}/${projectId}/${filename}`
    }

}

import { Project } from '../../models/Project.mjs'
import DocstoreManager from '../Docstore/DocstoreManager.mjs'
import HistoryManager from '../History/HistoryManager.mjs'
import ProjectEntityHandler from './ProjectEntityHandler.mjs'
import ProjectGetter from './ProjectGetter.mjs'
import Logger from '@overleaf/logger'
import crypto from 'crypto'

// Dynamic import for WebDAV client
let webdavModule = null
async function getWebDAVClient() {
    if (!webdavModule) {
        webdavModule = await import('webdav')
    }
    return webdavModule.createClient
}

// Helper functions to encode/decode file paths for MongoDB storage
// MongoDB doesn't allow dots (.) or dollar signs ($) in field names
// We use URL-style percent encoding which is well-known and handles edge cases
function encodePathForStorage(path) {
    // First encode % to prevent double-encoding issues, then encode . and $
    return path
        .replace(/%/g, '%25')   // Escape the escape character first
        .replace(/\./g, '%2E')  // Then encode dots
        .replace(/\$/g, '%24')  // Then encode dollar signs
}

function decodePathFromStorage(encodedPath) {
    // Decode in reverse order
    return encodedPath
        .replace(/%24/g, '$')
        .replace(/%2E/g, '.')
        .replace(/%25/g, '%')
}

/**
 * ProjectWebDAVSync - Syncs project files to WebDAV with user-friendly paths
 * 
 * This service syncs the actual project files (as seen in the editor) to WebDAV,
 * preserving the directory structure that users see.
 */
const ProjectWebDAVSync = {
    /**
     * Get WebDAV config for a project
     */
    async getWebDAVConfig(projectId) {
        const project = await Project.findById(projectId, { webdavConfig: 1 }).exec()
        if (!project || !project.webdavConfig || !project.webdavConfig.enabled) {
            return null
        }
        return project.webdavConfig
    },

    /**
     * Create a WebDAV client for the project
     */
    async createClient(config) {
        const createClient = await getWebDAVClient()
        return createClient(config.url, {
            username: config.username,
            password: config.password,
        })
    },

    /**
     * Ensure directory exists on WebDAV
     */
    async ensureDirectoryExists(client, dirPath, basePath) {
        const fullPath = `${basePath}${dirPath}`
        const parts = fullPath.split('/').filter(p => p)
        let currentPath = ''

        for (const part of parts) {
            currentPath += '/' + part
            try {
                const exists = await client.exists(currentPath)
                if (!exists) {
                    await client.createDirectory(currentPath)
                }
            } catch (err) {
                // Directory might already exist
                if (!err.message?.includes('405')) {
                    Logger.warn({ err, path: currentPath }, 'Error creating directory')
                }
            }
        }
    },

    /**
     * Sync a single document to WebDAV
     */
    async syncDocument(projectId, docId, docPath, content) {
        try {
            const config = await this.getWebDAVConfig(projectId)
            if (!config) {
                return
            }

            const client = await this.createClient(config)
            const basePath = config.basePath || '/overleaf'
            const remotePath = `${basePath}${docPath}`

            // Ensure parent directory exists
            const parentDir = docPath.substring(0, docPath.lastIndexOf('/'))
            if (parentDir) {
                await this.ensureDirectoryExists(client, parentDir, basePath)
            }

            // Upload the document
            await client.putFileContents(remotePath, content)
            Logger.info({ projectId, docPath, remotePath }, 'Document synced to WebDAV')
        } catch (err) {
            Logger.warn({ err, projectId, docPath }, 'Failed to sync document to WebDAV')
        }
    },

    /**
     * Sync a single file (binary) to WebDAV
     */
    async syncFile(projectId, fileId, filePath, fileStream) {
        try {
            const config = await this.getWebDAVConfig(projectId)
            if (!config) {
                return
            }

            const client = await this.createClient(config)
            const basePath = config.basePath || '/overleaf'
            const remotePath = `${basePath}${filePath}`

            // Ensure parent directory exists
            const parentDir = filePath.substring(0, filePath.lastIndexOf('/'))
            if (parentDir) {
                await this.ensureDirectoryExists(client, parentDir, basePath)
            }

            // Upload the file
            await client.putFileContents(remotePath, fileStream)
            Logger.info({ projectId, filePath, remotePath }, 'File synced to WebDAV')
        } catch (err) {
            Logger.warn({ err, projectId, filePath }, 'Failed to sync file to WebDAV')
        }
    },

    /**
     * Sync all project files to WebDAV
     * This is useful for initial sync or full resync
     * 
     * Only syncs files if:
     * 1. The file doesn't exist on WebDAV
     * 2. The project has been modified (lastUpdated > lastSyncDate) AND 
     *    the WebDAV file was last synced before the project's lastUpdated time
     *    (i.e., remoteModTime < projectLastUpdated)
     * 
     * This ensures that only files that have potentially changed since the last 
     * sync are re-uploaded, rather than all files.
     */
    async syncAllProjectFiles(projectId) {
        try {
            const config = await this.getWebDAVConfig(projectId)
            if (!config) {
                Logger.info({ projectId }, 'No WebDAV config, skipping sync')
                return
            }

            Logger.info({ projectId }, 'Starting full project sync to WebDAV')

            const project = await ProjectGetter.promises.getProject(projectId, {
                rootFolder: true,
                name: true,
                lastUpdated: true,
            })

            if (!project) {
                Logger.warn({ projectId }, 'Project not found for WebDAV sync')
                return
            }

            // Get project's last updated time for comparison
            const projectLastUpdated = project.lastUpdated ? new Date(project.lastUpdated) : null
            const lastSyncDate = config.lastSyncDate ? new Date(config.lastSyncDate) : null

            // Get the stored file hashes from previous syncs
            // Keys are encoded paths (dots replaced with fullwidth equivalents)
            // This is stored as a plain object in MongoDB
            const storedHashes = config.syncedFileHashes || {}

            console.error(`[WebDAV] Sync timing info:`)
            console.error(`[WebDAV]   projectLastUpdated: ${projectLastUpdated ? projectLastUpdated.toISOString() : 'null'}`)
            console.error(`[WebDAV]   lastSyncDate: ${lastSyncDate ? lastSyncDate.toISOString() : 'null'}`)
            console.error(`[WebDAV]   syncedFileHashes count: ${Object.keys(storedHashes).length}`)

            Logger.debug({ projectId, projectLastUpdated, lastSyncDate, syncedFileHashesCount: Object.keys(storedHashes).length },
                'Sync timing info')

            // If project hasn't been updated since last sync, skip entirely
            if (projectLastUpdated && lastSyncDate && projectLastUpdated <= lastSyncDate) {
                console.error(`[WebDAV] Project not modified since last sync, skipping entirely`)
                Logger.info({ projectId, projectLastUpdated, lastSyncDate },
                    'Project not modified since last sync, skipping')
                return
            }

            const { docs, files } = ProjectEntityHandler.getAllEntitiesFromProject(project)
            const client = await this.createClient(config)
            const basePath = config.basePath || '/overleaf'

            // Record sync start time
            const syncStartTime = new Date()
            console.error(`[WebDAV]   syncStartTime: ${syncStartTime.toISOString()}`)

            // Ensure base path directory exists
            try {
                const exists = await client.exists(basePath)
                if (!exists) {
                    await client.createDirectory(basePath)
                    Logger.info({ projectId, basePath }, 'Created basePath directory on WebDAV')
                }
            } catch (err) {
                Logger.warn({ err, basePath }, 'Could not create basePath directory, continuing anyway')
            }

            let syncedDocsCount = 0
            let skippedDocsCount = 0
            let syncedFilesCount = 0
            let skippedFilesCount = 0

            // Track updated hashes for this sync (using encoded paths as keys)
            const updatedHashes = { ...storedHashes }

            // Sync all documents
            for (const { path: docPath, doc } of docs) {
                try {
                    // Get document content first to compute hash
                    const docData = await DocstoreManager.promises.getDoc(
                        projectId.toString(),
                        doc._id.toString()
                    )
                    const content = docData.lines.join('\n')

                    // Compute hash of document content
                    const contentHash = crypto.createHash('md5').update(content).digest('hex')

                    // Check if hash has changed since last sync
                    const encodedDocPath = encodePathForStorage(docPath)
                    const previousHash = storedHashes[encodedDocPath]

                    console.error(`[WebDAV] Comparing doc ${docPath}:`)
                    console.error(`[WebDAV]   currentHash: ${contentHash}`)
                    console.error(`[WebDAV]   previousHash: ${previousHash || 'null'}`)

                    if (previousHash && previousHash === contentHash) {
                        console.error(`[WebDAV]   -> SKIPPING (hash unchanged)`)
                        Logger.debug({ projectId, docPath, contentHash },
                            'Skipping document sync - hash unchanged')
                        skippedDocsCount++
                        continue
                    }
                    console.error(`[WebDAV]   -> SYNCING (hash changed or new file)`)

                    const remotePath = `${basePath}${docPath}`
                    const parentDir = docPath.substring(0, docPath.lastIndexOf('/'))
                    if (parentDir) {
                        await this.ensureDirectoryExists(client, parentDir, basePath)
                    }

                    await client.putFileContents(remotePath, content, { overwrite: true })
                    Logger.info({ projectId, docPath }, 'Document synced to WebDAV')

                    // Update the hash in our tracking map (with encoded path)
                    updatedHashes[encodedDocPath] = contentHash
                    syncedDocsCount++
                } catch (err) {
                    Logger.warn({ err, projectId, docPath: docPath }, 'Failed to sync document')
                }
            }

            // Sync all files
            for (const { path: filePath, file } of files) {
                try {
                    // Use file.hash directly - this is already available
                    if (!file.hash) {
                        Logger.warn({ projectId, filePath, fileId: file._id }, 'File missing hash, skipping')
                        continue
                    }

                    const currentHash = file.hash

                    // Check if hash has changed since last sync
                    const encodedFilePath = encodePathForStorage(filePath)
                    const previousHash = storedHashes[encodedFilePath]

                    console.error(`[WebDAV] Comparing file ${filePath}:`)
                    console.error(`[WebDAV]   currentHash: ${currentHash}`)
                    console.error(`[WebDAV]   previousHash: ${previousHash || 'null'}`)

                    if (previousHash && previousHash === currentHash) {
                        console.error(`[WebDAV]   -> SKIPPING (hash unchanged)`)
                        Logger.debug({ projectId, filePath, currentHash },
                            'Skipping file sync - hash unchanged')
                        skippedFilesCount++
                        continue
                    }
                    console.error(`[WebDAV]   -> SYNCING (hash changed or new file)`)

                    const { stream } = await HistoryManager.promises.requestBlobWithProjectId(
                        projectId.toString(),
                        file.hash
                    )

                    // Read stream into buffer
                    const chunks = []
                    for await (const chunk of stream) {
                        chunks.push(chunk)
                    }
                    const buffer = Buffer.concat(chunks)

                    const remotePath = `${basePath}${filePath}`
                    const parentDir = filePath.substring(0, filePath.lastIndexOf('/'))
                    if (parentDir) {
                        await this.ensureDirectoryExists(client, parentDir, basePath)
                    }

                    await client.putFileContents(remotePath, buffer, { overwrite: true })
                    Logger.info({ projectId, filePath }, 'File synced to WebDAV')

                    // Update the hash in our tracking map (with encoded path)
                    updatedHashes[encodedFilePath] = currentHash
                    syncedFilesCount++
                } catch (err) {
                    Logger.warn({ err, projectId, filePath: filePath }, 'Failed to sync file')
                }
            }

            // updatedHashes is already an object with encoded paths as keys

            // Update last sync date and synced file hashes
            await Project.updateOne(
                { _id: projectId },
                {
                    $set: {
                        'webdavConfig.lastSyncDate': syncStartTime,
                        'webdavConfig.syncedFileHashes': updatedHashes
                    }
                }
            ).exec()
            console.error(`[WebDAV] Updated lastSyncDate to syncStartTime: ${syncStartTime.toISOString()}`)
            console.error(`[WebDAV] Updated syncedFileHashes: ${updatedHashes.size} entries`)

            Logger.info({
                projectId,
                syncedDocsCount,
                skippedDocsCount,
                syncedFilesCount,
                skippedFilesCount,
                totalDocs: docs.length,
                totalFiles: files.length
            }, 'Full project sync to WebDAV completed')
        } catch (err) {
            Logger.error({ err, projectId }, 'Failed to sync project to WebDAV')
            throw err
        }
    },

    /**
     * Delete a file/document from WebDAV
     */
    async deleteFromWebDAV(projectId, filePath) {
        try {
            const config = await this.getWebDAVConfig(projectId)
            if (!config) {
                return
            }

            const client = await this.createClient(config)
            const basePath = config.basePath || '/overleaf'
            const remotePath = `${basePath}${filePath}`

            try {
                await client.deleteFile(remotePath)
                Logger.info({ projectId, filePath, remotePath }, 'File deleted from WebDAV')
            } catch (err) {
                if (err.status !== 404) {
                    throw err
                }
                // File already doesn't exist, ignore
            }

            // Also remove the file hash from tracking (using encoded path)
            const encodedPath = encodePathForStorage(filePath)
            await Project.updateOne(
                { _id: projectId },
                { $unset: { [`webdavConfig.syncedFileHashes.${encodedPath}`]: '' } }
            ).exec()
        } catch (err) {
            Logger.warn({ err, projectId, filePath }, 'Failed to delete file from WebDAV')
        }
    },

    /**
     * Rename/move a file on WebDAV
     */
    async moveOnWebDAV(projectId, oldPath, newPath) {
        try {
            const config = await this.getWebDAVConfig(projectId)
            if (!config) {
                return
            }

            const client = await this.createClient(config)
            const basePath = config.basePath || '/overleaf'
            const oldRemotePath = `${basePath}${oldPath}`
            const newRemotePath = `${basePath}${newPath}`

            // Ensure new parent directory exists
            const parentDir = newPath.substring(0, newPath.lastIndexOf('/'))
            if (parentDir) {
                await this.ensureDirectoryExists(client, parentDir, basePath)
            }

            try {
                await client.moveFile(oldRemotePath, newRemotePath)
                Logger.info({ projectId, oldPath, newPath }, 'File moved on WebDAV')
            } catch (err) {
                if (err.status === 404) {
                    // Source doesn't exist, ignore
                    Logger.warn({ projectId, oldPath }, 'Source file not found for move')
                } else {
                    throw err
                }
            }

            // Update the hash tracking: transfer hash from old path to new path
            const storedHashes = config.syncedFileHashes || {}
            const encodedOldPath = encodePathForStorage(oldPath)
            const encodedNewPath = encodePathForStorage(newPath)

            const hash = storedHashes[encodedOldPath]
            if (hash) {
                delete storedHashes[encodedOldPath]
                storedHashes[encodedNewPath] = hash

                await Project.updateOne(
                    { _id: projectId },
                    { $set: { 'webdavConfig.syncedFileHashes': storedHashes } }
                ).exec()
            }
        } catch (err) {
            Logger.warn({ err, projectId, oldPath, newPath }, 'Failed to move file on WebDAV')
        }
    },

    /**
     * Delete all project files from WebDAV
     * This is called when user wants to delete remote content during unlink
     * 
     * Strategy: Try direct directory deletion first (preserves recycle bin if server supports it),
     * fall back to recursive deletion if direct deletion fails
     */
    async deleteAllFromWebDAV(projectId) {
        try {
            const config = await this.getWebDAVConfig(projectId)
            if (!config) {
                Logger.info({ projectId }, 'No WebDAV config, cannot delete remote content')
                return
            }

            const client = await this.createClient(config)
            const basePath = config.basePath || '/overleaf'

            Logger.info({ projectId, basePath }, 'Deleting all project files from WebDAV')

            // Check if the base path exists
            const exists = await client.exists(basePath)
            if (!exists) {
                Logger.info({ projectId, basePath }, 'WebDAV directory does not exist, nothing to delete')
                return
            }

            // First, try direct deletion (preserves recycle bin on servers that support it)
            try {
                await client.deleteFile(basePath)
                Logger.info({ projectId, basePath }, 'Successfully deleted WebDAV directory (direct deletion)')
                return
            } catch (directDeleteErr) {
                // If direct deletion fails (e.g., directory not empty on some servers),
                // fall back to recursive deletion
                if (directDeleteErr.status === 404) {
                    Logger.info({ projectId, basePath }, 'WebDAV directory not found, nothing to delete')
                    return
                }
                Logger.info({ projectId, basePath }, 'Direct deletion failed, falling back to recursive deletion')
            }

            // Fallback: Recursive deletion
            try {
                // Get all contents recursively
                const contents = await client.getDirectoryContents(basePath, { deep: true })
                
                // Sort by path length descending to delete nested items first
                contents.sort((a, b) => b.filename.length - a.filename.length)
                
                // Delete all files and directories
                for (const item of contents) {
                    try {
                        await client.deleteFile(item.filename)
                        Logger.debug({ projectId, path: item.filename }, 'Deleted item from WebDAV')
                    } catch (deleteErr) {
                        if (deleteErr.status !== 404) {
                            Logger.warn({ err: deleteErr, projectId, path: item.filename }, 'Failed to delete item from WebDAV')
                        }
                    }
                }
                
                // Finally delete the base directory itself
                try {
                    await client.deleteFile(basePath)
                    Logger.info({ projectId, basePath }, 'Successfully deleted WebDAV directory (recursive deletion)')
                } catch (deleteErr) {
                    if (deleteErr.status !== 404) {
                        Logger.warn({ err: deleteErr, projectId, basePath }, 'Failed to delete base directory')
                    }
                }
            } catch (err) {
                if (err.status === 404) {
                    Logger.info({ projectId, basePath }, 'WebDAV directory not found, nothing to delete')
                } else {
                    throw err
                }
            }
        } catch (err) {
            Logger.error({ err, projectId }, 'Failed to delete all files from WebDAV')
            throw err
        }
    },
}

export default ProjectWebDAVSync

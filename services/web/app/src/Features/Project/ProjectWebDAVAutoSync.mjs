/**
 * ProjectWebDAVAutoSync - Handles automatic WebDAV synchronization
 * 
 * Features:
 * - Periodic sync after modifications (configurable interval)
 * - Immediate sync for binary file changes
 * - Sync on project close with background execution
 * - Shared sync state across collaborators
 */

import { Project } from '../../models/Project.mjs'
import ProjectWebDAVSync from './ProjectWebDAVSync.mjs'
import Logger from '@overleaf/logger'

// Configuration
const DEFAULT_SYNC_INTERVAL_MS = 30 * 1000  // 30 seconds default
const SYNC_DEBOUNCE_MS = 5 * 1000  // 5 seconds debounce

// In-memory state for pending syncs and timers
// This is shared across all connections to the same project
const pendingSyncs = new Map()  // projectId -> { timer, hasPendingChanges, isBinaryChange, lastModifiedAt }
const syncInProgress = new Map()  // projectId -> Promise

const ProjectWebDAVAutoSync = {
    /**
     * Get sync interval from settings or use default
     */
    getSyncInterval() {
        return process.env.WEBDAV_SYNC_INTERVAL_MS
            ? parseInt(process.env.WEBDAV_SYNC_INTERVAL_MS, 10)
            : DEFAULT_SYNC_INTERVAL_MS
    },

    /**
     * Mark a project as having pending changes that need sync
     * This is called when documents or files are modified
     * 
     * @param {string} projectId - The project ID
     * @param {boolean} isBinaryChange - Whether this is a binary file change (needs immediate sync)
     */
    async markPendingSync(projectId, isBinaryChange = false) {
        const projectIdStr = projectId.toString()

        try {
            // Check if WebDAV is enabled for this project
            const project = await Project.findById(projectId, { webdavConfig: 1 }).exec()
            if (!project?.webdavConfig?.enabled) {
                return
            }

            const existing = pendingSyncs.get(projectIdStr) || {
                timer: null,
                hasPendingChanges: false,
                isBinaryChange: false,
                lastModifiedAt: null,
            }

            existing.hasPendingChanges = true
            existing.lastModifiedAt = new Date()

            // If it's a binary change, mark for immediate sync
            if (isBinaryChange) {
                existing.isBinaryChange = true
            }

            // Clear existing timer
            if (existing.timer) {
                clearTimeout(existing.timer)
                existing.timer = null
            }

            // If binary change, trigger immediate sync
            if (existing.isBinaryChange) {
                Logger.debug({ projectId: projectIdStr }, 'Binary change detected, triggering immediate WebDAV sync')
                pendingSyncs.set(projectIdStr, existing)
                await this.triggerSync(projectIdStr)
                return
            }

            // Check if enough time has passed since last sync
            const lastSyncDate = project.webdavConfig.lastSyncDate
            const syncInterval = this.getSyncInterval()
            const now = Date.now()

            if (lastSyncDate && (now - new Date(lastSyncDate).getTime()) >= syncInterval) {
                // Enough time has passed, trigger sync after debounce
                Logger.debug({ projectId: projectIdStr, syncInterval }, 'Sync interval exceeded, scheduling WebDAV sync')
                existing.timer = setTimeout(() => {
                    this.triggerSync(projectIdStr).catch(err => {
                        Logger.warn({ err, projectId: projectIdStr }, 'Background WebDAV sync failed')
                    })
                }, SYNC_DEBOUNCE_MS)
            } else {
                // Schedule sync after interval expires
                const timeUntilSync = lastSyncDate
                    ? Math.max(syncInterval - (now - new Date(lastSyncDate).getTime()), SYNC_DEBOUNCE_MS)
                    : SYNC_DEBOUNCE_MS

                Logger.debug({ projectId: projectIdStr, timeUntilSync }, 'Scheduling WebDAV sync')
                existing.timer = setTimeout(() => {
                    this.triggerSync(projectIdStr).catch(err => {
                        Logger.warn({ err, projectId: projectIdStr }, 'Background WebDAV sync failed')
                    })
                }, timeUntilSync)
            }

            pendingSyncs.set(projectIdStr, existing)
        } catch (err) {
            Logger.warn({ err, projectId: projectIdStr }, 'Error in markPendingSync')
        }
    },

    /**
     * Trigger a sync for a project
     * Uses locking to prevent multiple simultaneous syncs
     * 
     * @param {string} projectId - The project ID
     * @returns {Promise<boolean>} - Whether sync was performed
     */
    async triggerSync(projectId) {
        const projectIdStr = projectId.toString()

        // Check if sync is already in progress
        if (syncInProgress.has(projectIdStr)) {
            Logger.debug({ projectId: projectIdStr }, 'Sync already in progress, waiting')
            try {
                await syncInProgress.get(projectIdStr)
            } catch (err) {
                // Previous sync failed, continue with new sync
            }
        }

        // Check if there are pending changes
        const pending = pendingSyncs.get(projectIdStr)
        if (!pending?.hasPendingChanges) {
            Logger.debug({ projectId: projectIdStr }, 'No pending changes for WebDAV sync')
            return false
        }

        // Create sync promise
        const syncPromise = (async () => {
            try {
                Logger.info({ projectId: projectIdStr }, 'Starting automatic WebDAV sync')
                await ProjectWebDAVSync.syncAllProjectFiles(projectId)

                // Clear pending state after successful sync
                const state = pendingSyncs.get(projectIdStr)
                if (state) {
                    if (state.timer) {
                        clearTimeout(state.timer)
                    }
                    pendingSyncs.delete(projectIdStr)
                }

                Logger.info({ projectId: projectIdStr }, 'Automatic WebDAV sync completed')
                return true
            } catch (err) {
                Logger.error({ err, projectId: projectIdStr }, 'Automatic WebDAV sync failed')
                throw err
            } finally {
                syncInProgress.delete(projectIdStr)
            }
        })()

        syncInProgress.set(projectIdStr, syncPromise)
        return syncPromise
    },

    /**
     * Sync on project close
     * This should be called when a project is closed (no more active connections)
     * Runs in background to avoid blocking the disconnect flow
     * 
     * @param {string} projectId - The project ID
     * @returns {Promise<void>}
     */
    async syncOnProjectClose(projectId) {
        const projectIdStr = projectId.toString()

        try {
            // Check if there are pending changes
            const pending = pendingSyncs.get(projectIdStr)
            if (!pending?.hasPendingChanges) {
                Logger.debug({ projectId: projectIdStr }, 'No pending changes on project close')
                return
            }

            // Check if WebDAV is enabled
            const project = await Project.findById(projectId, { webdavConfig: 1 }).exec()
            if (!project?.webdavConfig?.enabled) {
                return
            }

            Logger.info({ projectId: projectIdStr }, 'Syncing to WebDAV on project close')

            // Run sync - this will complete even if the caller doesn't wait
            // Use setImmediate to ensure it runs in the background
            setImmediate(async () => {
                try {
                    await this.triggerSync(projectIdStr)
                } catch (err) {
                    Logger.error({ err, projectId: projectIdStr }, 'WebDAV sync on project close failed')
                }
            })
        } catch (err) {
            Logger.warn({ err, projectId: projectIdStr }, 'Error in syncOnProjectClose')
        }
    },

    /**
     * Force sync a project immediately
     * Used for explicit sync requests
     * 
     * @param {string} projectId - The project ID
     * @returns {Promise<boolean>}
     */
    async forceSync(projectId) {
        const projectIdStr = projectId.toString()

        // Mark as having pending changes to ensure sync runs
        const existing = pendingSyncs.get(projectIdStr) || {
            timer: null,
            hasPendingChanges: true,
            isBinaryChange: false,
            lastModifiedAt: new Date(),
        }
        existing.hasPendingChanges = true
        pendingSyncs.set(projectIdStr, existing)

        return this.triggerSync(projectIdStr)
    },

    /**
     * Check if a project has pending unsynchronized changes
     * 
     * @param {string} projectId - The project ID
     * @returns {boolean}
     */
    hasPendingChanges(projectId) {
        const pending = pendingSyncs.get(projectId.toString())
        return pending?.hasPendingChanges || false
    },

    /**
     * Cancel pending sync for a project
     * 
     * @param {string} projectId - The project ID
     */
    cancelPendingSync(projectId) {
        const projectIdStr = projectId.toString()
        const pending = pendingSyncs.get(projectIdStr)
        if (pending?.timer) {
            clearTimeout(pending.timer)
        }
        pendingSyncs.delete(projectIdStr)
    },

    /**
     * Get sync status for debugging/monitoring
     * 
     * @param {string} projectId - The project ID
     * @returns {object}
     */
    getStatus(projectId) {
        const projectIdStr = projectId.toString()
        const pending = pendingSyncs.get(projectIdStr)
        const inProgress = syncInProgress.has(projectIdStr)

        return {
            hasPendingChanges: pending?.hasPendingChanges || false,
            isBinaryChange: pending?.isBinaryChange || false,
            lastModifiedAt: pending?.lastModifiedAt || null,
            syncInProgress: inProgress,
        }
    },
}

export default ProjectWebDAVAutoSync

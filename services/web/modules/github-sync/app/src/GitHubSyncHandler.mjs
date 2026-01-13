import path from 'node:path'
import fs from 'node:fs/promises'
import { User } from '../../../../app/src/models/User.mjs'
import { Project } from '../../../../app/src/models/Project.mjs'
import ProjectEntityHandler from '../../../../app/src/Features/Project/ProjectEntityHandler.mjs'
import ProjectCreationHandler from '../../../../app/src/Features/Project/ProjectCreationHandler.mjs'
import ProjectEntityUpdateHandler from '../../../../app/src/Features/Project/ProjectEntityUpdateHandler.mjs'
import ProjectGetter from '../../../../app/src/Features/Project/ProjectGetter.js'
import FileStoreHandler from '../../../../app/src/Features/FileStore/FileStoreHandler.mjs'
import GitHubSyncEncryption from './GitHubSyncEncryption.mjs'
import GitHubApiClient from './GitHubApiClient.mjs'
import GitOperations from './GitOperations.mjs'

/**
 * Connect a user's GitHub account by storing their PAT
 * @param {string} userId - User ID
 * @param {string} pat - Personal Access Token
 * @returns {Promise<{username: string}>}
 */
async function connectUserGitHub(userId, pat) {
  // Verify PAT with GitHub
  const githubUser = await GitHubApiClient.verifyPat(pat)

  // Encrypt the PAT
  const tokenEncrypted = GitHubSyncEncryption.encrypt(pat)

  // Update user document
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        'githubSync.enabled': true,
        'githubSync.tokenEncrypted': tokenEncrypted,
        'githubSync.username': githubUser.login,
        'githubSync.connectedAt': new Date(),
      },
    }
  )

  return { username: githubUser.login }
}

/**
 * Disconnect a user's GitHub account
 * @param {string} userId - User ID
 */
async function disconnectUserGitHub(userId) {
  await User.updateOne(
    { _id: userId },
    {
      $set: {
        'githubSync.enabled': false,
      },
      $unset: {
        'githubSync.tokenEncrypted': 1,
        'githubSync.username': 1,
        'githubSync.connectedAt': 1,
      },
    }
  )
}

/**
 * Get user's GitHub sync status
 * @param {string} userId - User ID
 * @returns {Promise<{connected: boolean, username?: string}>}
 */
async function getUserGitHubStatus(userId) {
  const user = await User.findById(userId, 'githubSync').lean()

  if (!user?.githubSync?.enabled) {
    return { connected: false }
  }

  return {
    connected: true,
    username: user.githubSync.username,
  }
}

/**
 * Get decrypted PAT for a user
 * @param {string} userId - User ID
 * @returns {Promise<string|null>}
 */
async function getUserPat(userId) {
  const user = await User.findById(userId, 'githubSync.tokenEncrypted').lean()

  if (!user?.githubSync?.tokenEncrypted) {
    return null
  }

  return GitHubSyncEncryption.decrypt(user.githubSync.tokenEncrypted)
}

/**
 * List user's GitHub repositories
 * @param {string} userId - User ID
 * @returns {Promise<Array>}
 */
async function listUserRepos(userId) {
  const pat = await getUserPat(userId)
  if (!pat) {
    throw new Error('GitHub not connected')
  }

  return await GitHubApiClient.listRepos(pat)
}

/**
 * List branches for a repository
 * @param {string} userId - User ID
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Array>}
 */
async function listRepoBranches(userId, owner, repo) {
  const pat = await getUserPat(userId)
  if (!pat) {
    throw new Error('GitHub not connected')
  }

  return await GitHubApiClient.listBranches(pat, owner, repo)
}

/**
 * Configure GitHub sync for a project
 * @param {string} projectId - Project ID
 * @param {string} userId - User ID
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch name
 */
async function configureProjectSync(projectId, userId, owner, repo, branch) {
  const pat = await getUserPat(userId)
  if (!pat) {
    throw new Error('GitHub not connected')
  }

  // Verify repository access
  const access = await GitHubApiClient.checkRepoAccess(pat, owner, repo)
  if (!access.exists) {
    throw new Error('Repository not found')
  }
  if (!access.hasWriteAccess) {
    throw new Error('No write access to repository')
  }

  // Update project
  await Project.updateOne(
    { _id: projectId },
    {
      $set: {
        'githubSync.enabled': true,
        'githubSync.repoOwner': owner,
        'githubSync.repoName': repo,
        'githubSync.branch': branch,
      },
    }
  )
}

/**
 * Remove GitHub sync configuration from a project
 * @param {string} projectId - Project ID
 */
async function unconfigureProjectSync(projectId) {
  await Project.updateOne(
    { _id: projectId },
    {
      $set: {
        'githubSync.enabled': false,
      },
      $unset: {
        'githubSync.repoOwner': 1,
        'githubSync.repoName': 1,
        'githubSync.branch': 1,
        'githubSync.lastSyncedAt': 1,
        'githubSync.lastSyncedBy': 1,
      },
    }
  )
}

/**
 * Get project's GitHub sync status
 * @param {string} projectId - Project ID
 * @returns {Promise<Object>}
 */
async function getProjectSyncStatus(projectId) {
  const project = await Project.findById(projectId, 'githubSync').lean()

  if (!project?.githubSync?.enabled) {
    return { configured: false }
  }

  return {
    configured: true,
    repoOwner: project.githubSync.repoOwner,
    repoName: project.githubSync.repoName,
    branch: project.githubSync.branch,
    lastSyncedAt: project.githubSync.lastSyncedAt,
  }
}

/**
 * Push project to GitHub
 * @param {string} projectId - Project ID
 * @param {string} userId - User ID
 */
async function pushProjectToGitHub(projectId, userId) {
  // Get project and user data
  const project = await Project.findById(projectId, 'name githubSync').lean()
  if (!project?.githubSync?.enabled) {
    throw new Error('GitHub sync not configured for this project')
  }

  const pat = await getUserPat(userId)
  if (!pat) {
    throw new Error('GitHub not connected')
  }

  const { repoOwner, repoName, branch } = project.githubSync

  // Create temp directory
  const tempDir = await GitOperations.createTempDir()

  try {
    // Export all docs
    const docs = await ProjectEntityHandler.promises.getAllDocs(projectId)
    for (const doc of docs) {
      const filePath = path.join(tempDir, doc.path)
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      await fs.writeFile(filePath, doc.lines.join('\n'))
    }

    // Export all files (binary files)
    const files = await ProjectEntityHandler.promises.getAllFiles(projectId)
    for (const file of files) {
      const filePath = path.join(tempDir, file.path)
      await fs.mkdir(path.dirname(filePath), { recursive: true })

      // Get file from FileStore
      const stream = await FileStoreHandler.promises.getFileStream(
        projectId,
        file.file._id.toString()
      )

      const writeStream = (await import('node:fs')).createWriteStream(filePath)
      await new Promise((resolve, reject) => {
        stream.pipe(writeStream)
        stream.on('error', reject)
        writeStream.on('finish', resolve)
        writeStream.on('error', reject)
      })
    }

    // Push to GitHub
    const commitMessage = `Sync from Overleaf: ${project.name}`
    await GitOperations.pushToGitHub(tempDir, pat, repoOwner, repoName, branch, commitMessage)

    // Update last synced time
    await Project.updateOne(
      { _id: projectId },
      {
        $set: {
          'githubSync.lastSyncedAt': new Date(),
          'githubSync.lastSyncedBy': userId,
        },
      }
    )
  } finally {
    // Cleanup temp directory
    await GitOperations.removeTempDir(tempDir)
  }
}

/**
 * Import a GitHub repository as a new Overleaf project
 * @param {string} userId - User ID
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch to import
 * @returns {Promise<{projectId: string}>}
 */
async function importFromGitHub(userId, owner, repo, branch) {
  const pat = await getUserPat(userId)
  if (!pat) {
    throw new Error('GitHub not connected')
  }

  // Clone repository
  const tempDir = await GitOperations.cloneRepo(pat, owner, repo, branch)

  try {
    // Create new project
    const projectName = repo
    const project = await ProjectCreationHandler.promises.createBlankProject(
      userId,
      projectName
    )

    // Get list of files from cloned repo
    const files = await GitOperations.listFiles(tempDir)

    // Get root folder ID
    const rootFolderId = project.rootFolder[0]._id

    // Add files to project
    for (const filePath of files) {
      const fullPath = path.join(tempDir, filePath)
      const content = await fs.readFile(fullPath)
      const fileName = path.basename(filePath)
      const dirPath = path.dirname(filePath)

      // Determine folder to add to
      let folderId = rootFolderId

      // Create folder structure if needed
      if (dirPath !== '.') {
        const folderParts = dirPath.split(path.sep)
        for (const folderName of folderParts) {
          // For simplicity, add to root. A full implementation would create subfolders.
          // TODO: Create proper folder structure
        }
      }

      // Check if it's a text file (likely .tex, .bib, .sty, etc.)
      const textExtensions = ['.tex', '.bib', '.sty', '.cls', '.txt', '.md', '.bst', '.cfg']
      const ext = path.extname(fileName).toLowerCase()

      if (textExtensions.includes(ext)) {
        // Add as doc
        const lines = content.toString('utf8').split('\n')
        await ProjectEntityUpdateHandler.promises.addDoc(
          project._id.toString(),
          folderId.toString(),
          fileName,
          lines,
          userId,
          'github-import'
        )
      } else {
        // Add as file
        await ProjectEntityUpdateHandler.promises.addFile(
          project._id.toString(),
          folderId.toString(),
          fileName,
          content,
          null, // linkedFileData
          userId,
          'github-import'
        )
      }
    }

    // Configure GitHub sync for the new project
    await configureProjectSync(project._id.toString(), userId, owner, repo, branch)

    return { projectId: project._id.toString() }
  } finally {
    // Cleanup temp directory
    await GitOperations.removeTempDir(tempDir)
  }
}

export default {
  promises: {
    connectUserGitHub,
    disconnectUserGitHub,
    getUserGitHubStatus,
    getUserPat,
    listUserRepos,
    listRepoBranches,
    configureProjectSync,
    unconfigureProjectSync,
    getProjectSyncStatus,
    pushProjectToGitHub,
    importFromGitHub,
  },
}

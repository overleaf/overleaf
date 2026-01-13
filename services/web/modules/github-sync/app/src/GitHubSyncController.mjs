import { expressify } from '@overleaf/promise-utils'
import SessionManager from '../../../../app/src/Features/Authentication/SessionManager.mjs'
import GitHubSyncHandler from './GitHubSyncHandler.mjs'

/**
 * Connect user's GitHub account
 */
async function connect(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { pat } = req.body

  if (!pat) {
    return res.status(400).json({ error: 'Personal Access Token is required' })
  }

  try {
    const result = await GitHubSyncHandler.promises.connectUserGitHub(userId, pat)
    res.json({ success: true, username: result.username })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

/**
 * Disconnect user's GitHub account
 */
async function disconnect(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)

  await GitHubSyncHandler.promises.disconnectUserGitHub(userId)
  res.json({ success: true })
}

/**
 * Get user's GitHub connection status
 */
async function getStatus(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)

  const status = await GitHubSyncHandler.promises.getUserGitHubStatus(userId)
  res.json(status)
}

/**
 * List user's GitHub repositories
 */
async function listRepos(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)

  try {
    const repos = await GitHubSyncHandler.promises.listUserRepos(userId)
    res.json({ repos })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

/**
 * List branches for a repository
 */
async function listBranches(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { owner, repo } = req.params

  try {
    const branches = await GitHubSyncHandler.promises.listRepoBranches(userId, owner, repo)
    res.json({ branches })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

/**
 * Configure GitHub sync for a project
 */
async function configureProject(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { Project_id: projectId } = req.params
  const { owner, repo, branch } = req.body

  if (!owner || !repo || !branch) {
    return res.status(400).json({ error: 'Owner, repo, and branch are required' })
  }

  try {
    await GitHubSyncHandler.promises.configureProjectSync(projectId, userId, owner, repo, branch)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

/**
 * Remove GitHub sync configuration from a project
 */
async function unconfigureProject(req, res) {
  const { Project_id: projectId } = req.params

  await GitHubSyncHandler.promises.unconfigureProjectSync(projectId)
  res.json({ success: true })
}

/**
 * Get project's GitHub sync status
 */
async function getProjectStatus(req, res) {
  const { Project_id: projectId } = req.params

  const status = await GitHubSyncHandler.promises.getProjectSyncStatus(projectId)
  res.json(status)
}

/**
 * Push project to GitHub
 */
async function pushProject(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { Project_id: projectId } = req.params

  try {
    await GitHubSyncHandler.promises.pushProjectToGitHub(projectId, userId)
    res.json({ success: true })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

/**
 * Import a GitHub repository as a new project
 */
async function importRepo(req, res) {
  const userId = SessionManager.getLoggedInUserId(req.session)
  const { owner, repo, branch } = req.body

  if (!owner || !repo || !branch) {
    return res.status(400).json({ error: 'Owner, repo, and branch are required' })
  }

  try {
    const result = await GitHubSyncHandler.promises.importFromGitHub(userId, owner, repo, branch)
    res.json({ success: true, projectId: result.projectId })
  } catch (error) {
    res.status(400).json({ error: error.message })
  }
}

export default {
  connect: expressify(connect),
  disconnect: expressify(disconnect),
  getStatus: expressify(getStatus),
  listRepos: expressify(listRepos),
  listBranches: expressify(listBranches),
  configureProject: expressify(configureProject),
  unconfigureProject: expressify(unconfigureProject),
  getProjectStatus: expressify(getProjectStatus),
  pushProject: expressify(pushProject),
  importRepo: expressify(importRepo),
}

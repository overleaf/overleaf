import fetch from 'node-fetch'

const GITHUB_API_BASE = 'https://api.github.com'

/**
 * Create headers for GitHub API requests
 * @param {string} pat - Personal Access Token
 * @returns {Object}
 */
function getHeaders(pat) {
  return {
    Accept: 'application/vnd.github+json',
    Authorization: `Bearer ${pat}`,
    'X-GitHub-Api-Version': '2022-11-28',
    'User-Agent': 'Overleaf-GitHub-Sync',
  }
}

/**
 * Verify PAT and get user info
 * @param {string} pat - Personal Access Token
 * @returns {Promise<{login: string, id: number, name: string}>}
 */
async function verifyPat(pat) {
  const response = await fetch(`${GITHUB_API_BASE}/user`, {
    headers: getHeaders(pat),
  })

  if (!response.ok) {
    if (response.status === 401) {
      throw new Error('Invalid GitHub Personal Access Token')
    }
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const user = await response.json()
  return {
    login: user.login,
    id: user.id,
    name: user.name,
  }
}

/**
 * List repositories for the authenticated user
 * @param {string} pat - Personal Access Token
 * @param {number} [page=1] - Page number
 * @param {number} [perPage=100] - Results per page
 * @returns {Promise<Array<{owner: string, name: string, fullName: string, private: boolean, defaultBranch: string}>>}
 */
async function listRepos(pat, page = 1, perPage = 100) {
  const params = new URLSearchParams({
    page: page.toString(),
    per_page: perPage.toString(),
    sort: 'updated',
    direction: 'desc',
  })

  const response = await fetch(
    `${GITHUB_API_BASE}/user/repos?${params.toString()}`,
    {
      headers: getHeaders(pat),
    }
  )

  if (!response.ok) {
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const repos = await response.json()
  return repos.map(repo => ({
    owner: repo.owner.login,
    name: repo.name,
    fullName: repo.full_name,
    private: repo.private,
    defaultBranch: repo.default_branch,
  }))
}

/**
 * List branches for a repository
 * @param {string} pat - Personal Access Token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<Array<{name: string, protected: boolean}>>}
 */
async function listBranches(pat, owner, repo) {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}/branches`,
    {
      headers: getHeaders(pat),
    }
  )

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error('Repository not found')
    }
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const branches = await response.json()
  return branches.map(branch => ({
    name: branch.name,
    protected: branch.protected,
  }))
}

/**
 * Check if a repository exists and user has access
 * @param {string} pat - Personal Access Token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @returns {Promise<{exists: boolean, hasWriteAccess: boolean, defaultBranch: string}>}
 */
async function checkRepoAccess(pat, owner, repo) {
  const response = await fetch(
    `${GITHUB_API_BASE}/repos/${owner}/${repo}`,
    {
      headers: getHeaders(pat),
    }
  )

  if (!response.ok) {
    if (response.status === 404) {
      return { exists: false, hasWriteAccess: false, defaultBranch: null }
    }
    throw new Error(`GitHub API error: ${response.status}`)
  }

  const repoData = await response.json()
  return {
    exists: true,
    hasWriteAccess: repoData.permissions?.push ?? false,
    defaultBranch: repoData.default_branch,
  }
}

export default {
  verifyPat,
  listRepos,
  listBranches,
  checkRepoAccess,
}

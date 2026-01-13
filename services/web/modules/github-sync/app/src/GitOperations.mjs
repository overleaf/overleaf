import { spawn } from 'node:child_process'
import fs from 'node:fs/promises'
import path from 'node:path'
import os from 'node:os'
import crypto from 'node:crypto'

/**
 * Sanitize git error messages to remove any embedded credentials
 * @param {string} message - Error message that may contain credentials
 * @returns {string} - Sanitized message with credentials replaced
 */
function sanitizeGitError(message) {
  // Remove credentials from URLs like https://token@github.com/...
  return message.replace(/https:\/\/[^@\s]+@/g, 'https://***@')
}

/**
 * Execute a git command
 * @param {string[]} args - Git command arguments
 * @param {string} cwd - Working directory
 * @param {Object} [env] - Additional environment variables
 * @returns {Promise<{stdout: string, stderr: string}>}
 */
function execGit(args, cwd, env = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn('git', args, {
      cwd,
      env: {
        ...process.env,
        GIT_TERMINAL_PROMPT: '0', // Prevent interactive prompts
        ...env,
      },
    })

    let stdout = ''
    let stderr = ''

    child.stdout.on('data', data => {
      stdout += data.toString()
    })

    child.stderr.on('data', data => {
      stderr += data.toString()
    })

    child.on('close', code => {
      if (code === 0) {
        resolve({ stdout, stderr })
      } else {
        // Sanitize stderr to remove any credentials before including in error
        const sanitizedStderr = sanitizeGitError(stderr)
        const error = new Error(`Git command failed with code ${code}: ${sanitizedStderr}`)
        error.code = code
        error.stderr = sanitizedStderr
        reject(error)
      }
    })

    child.on('error', reject)
  })
}

/**
 * Create a temporary directory for git operations
 * @returns {Promise<string>} Path to temp directory
 */
async function createTempDir() {
  const tempBase = os.tmpdir()
  const dirName = `overleaf-github-sync-${crypto.randomBytes(8).toString('hex')}`
  const tempDir = path.join(tempBase, dirName)
  await fs.mkdir(tempDir, { mode: 0o700, recursive: true })
  return tempDir
}

/**
 * Remove a temporary directory and all its contents
 * @param {string} dirPath - Path to directory
 */
async function removeTempDir(dirPath) {
  try {
    await fs.rm(dirPath, { recursive: true, force: true })
  } catch (error) {
    console.error(`Failed to remove temp directory ${dirPath}:`, error)
  }
}

/**
 * Clone a GitHub repository to a temporary directory
 * @param {string} pat - Personal Access Token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch to clone
 * @returns {Promise<string>} Path to cloned repository
 */
async function cloneRepo(pat, owner, repo, branch) {
  const tempDir = await createTempDir()
  // Use clean URL without credentials - PAT is passed via credential helper
  const cloneUrl = `https://github.com/${owner}/${repo}.git`

  try {
    await execGit(
      [
        '-c', `credential.helper=!f() { echo "password=${pat}"; }; f`,
        'clone', '--depth', '1', '--branch', branch, cloneUrl, '.'
      ],
      tempDir
    )

    // Remove .git directory to get just the files
    await fs.rm(path.join(tempDir, '.git'), { recursive: true, force: true })

    return tempDir
  } catch (error) {
    await removeTempDir(tempDir)
    throw error
  }
}

/**
 * Initialize a git repo and push to GitHub
 * @param {string} projectDir - Directory containing project files
 * @param {string} pat - Personal Access Token
 * @param {string} owner - Repository owner
 * @param {string} repo - Repository name
 * @param {string} branch - Branch to push to
 * @param {string} commitMessage - Commit message
 * @returns {Promise<void>}
 */
async function pushToGitHub(projectDir, pat, owner, repo, branch, commitMessage) {
  // Use clean URL without credentials - PAT is passed via credential helper
  const repoUrl = `https://github.com/${owner}/${repo}.git`

  // Initialize git repo
  await execGit(['init'], projectDir)

  // Configure git user (required for commit)
  await execGit(['config', 'user.email', 'overleaf@localhost'], projectDir)
  await execGit(['config', 'user.name', 'Overleaf'], projectDir)

  // Add all files
  await execGit(['add', '-A'], projectDir)

  // Create commit
  await execGit(['commit', '-m', commitMessage, '--allow-empty'], projectDir)

  // Add remote (clean URL without credentials)
  await execGit(['remote', 'add', 'origin', repoUrl], projectDir)

  // Force push to the specified branch using credential helper for auth
  await execGit(
    [
      '-c', `credential.helper=!f() { echo "password=${pat}"; }; f`,
      'push', '--force', 'origin', `HEAD:${branch}`
    ],
    projectDir
  )
}

/**
 * List all files in a directory recursively
 * @param {string} dirPath - Directory path
 * @param {string} [basePath=''] - Base path for relative paths
 * @returns {Promise<string[]>} List of relative file paths
 */
async function listFiles(dirPath, basePath = '') {
  const files = []
  const entries = await fs.readdir(dirPath, { withFileTypes: true })

  for (const entry of entries) {
    const relativePath = basePath ? path.join(basePath, entry.name) : entry.name

    // Skip hidden files/directories (like .git)
    if (entry.name.startsWith('.')) {
      continue
    }

    if (entry.isDirectory()) {
      const subFiles = await listFiles(path.join(dirPath, entry.name), relativePath)
      files.push(...subFiles)
    } else {
      files.push(relativePath)
    }
  }

  return files
}

export default {
  createTempDir,
  removeTempDir,
  cloneRepo,
  pushToGitHub,
  listFiles,
  execGit,
}

import _ from 'lodash'
import ProjectGetter from './ProjectGetter.mjs'
import UserGetter from '../User/UserGetter.mjs'
import { Project } from '../../models/Project.mjs'
import logger from '@overleaf/logger'
import TpdsUpdateSender from '../ThirdPartyDataStore/TpdsUpdateSender.mjs'
import PublicAccessLevels from '../Authorization/PublicAccessLevels.mjs'
import Errors from '../Errors/Errors.js'
import TokenGenerator from '../TokenGenerator/TokenGenerator.mjs'
import ProjectHelper from './ProjectHelper.mjs'
import settings from '@overleaf/settings'
import { callbackify } from 'node:util'

const MAX_PROJECT_NAME_LENGTH = 150

export default {
  MAX_PROJECT_NAME_LENGTH,
  getDetails: callbackify(getDetails),
  getProjectDescription: callbackify(getProjectDescription),
  setProjectDescription: callbackify(setProjectDescription),
  renameProject: callbackify(renameProject),
  validateProjectName: callbackify(validateProjectName),
  generateUniqueName: callbackify(generateUniqueName),
  setPublicAccessLevel: callbackify(setPublicAccessLevel),
  ensureTokensArePresent: callbackify(ensureTokensArePresent),
  clearTokens: callbackify(clearTokens),
  fixProjectName,
  promises: {
    getDetails,
    getProjectDescription,
    setProjectDescription,
    renameProject,
    validateProjectName,
    generateUniqueName,
    setPublicAccessLevel,
    ensureTokensArePresent,
    clearTokens,
  },
}

async function getDetails(projectId) {
  let project
  try {
    project = await ProjectGetter.promises.getProject(projectId, {
      name: true,
      description: true,
      compiler: true,
      features: true,
      owner_ref: true,
      overleaf: true,
    })
  } catch (err) {
    logger.warn({ err, projectId }, 'error getting project')
    throw err
  }
  if (project == null) {
    throw new Errors.NotFoundError('project not found')
  }
  const user = await UserGetter.promises.getUser(project.owner_ref)
  const details = {
    name: project.name,
    description: project.description,
    compiler: project.compiler,
    features:
      user != null && user.features != null
        ? user.features
        : settings.defaultFeatures,
  }
  if (project.overleaf != null) {
    details.overleaf = project.overleaf
  }
  return details
}

async function getProjectDescription(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    description: true,
  })
  if (project == null) {
    return undefined
  }
  return project.description
}

async function setProjectDescription(projectId, description) {
  const conditions = { _id: projectId }
  const update = { description }
  logger.debug(
    { conditions, update, projectId, description },
    'setting project description'
  )
  try {
    await Project.updateOne(conditions, update).exec()
  } catch (err) {
    logger.warn({ err }, 'something went wrong setting project description')
    throw err
  }
}
async function renameProject(projectId, newName) {
  newName = newName.trim()
  await validateProjectName(newName)
  logger.debug({ projectId, newName }, 'renaming project')
  let project
  try {
    project = await ProjectGetter.promises.getProject(projectId, { name: true })
  } catch (err) {
    logger.warn({ err, projectId }, 'error getting project')
    throw err
  }
  if (project == null) {
    logger.warn({ projectId }, 'could not find project to rename')
    return
  }
  const oldProjectName = project.name
  await Project.updateOne({ _id: projectId }, { name: newName }).exec()
  await TpdsUpdateSender.promises.moveEntity({
    projectId,
    projectName: oldProjectName,
    newProjectName: newName,
  })
}

async function validateProjectName(name) {
  if (name == null || name.length === 0) {
    throw new Errors.InvalidNameError('Project name cannot be blank')
  }
  if (name.length > MAX_PROJECT_NAME_LENGTH) {
    throw new Errors.InvalidNameError('Project name is too long')
  }
  if (name.indexOf('/') > -1) {
    throw new Errors.InvalidNameError(
      'Project name cannot contain / characters'
    )
  }
  if (name.indexOf('\\') > -1) {
    throw new Errors.InvalidNameError(
      'Project name cannot contain \\ characters'
    )
  }
  if (name !== name.trim()) {
    throw new Errors.InvalidNameError(
      'Project name cannot start or end with whitespace'
    )
  }
}

// FIXME: we should put a lock around this to make it completely safe, but we would need to do that at
// the point of project creation, rather than just checking the name at the start of the import.
// If we later move this check into ProjectCreationHandler we can ensure all new projects are created
// with a unique name.  But that requires thinking through how we would handle incoming projects from
// dropbox for example.
async function generateUniqueName(userId, name, suffixes = []) {
  const allUsersProjectNames =
    await ProjectGetter.promises.findAllUsersProjects(userId, { name: 1 })
  // allUsersProjectNames is returned as a hash {owned: [name1, name2, ...], readOnly: [....]}
  // collect all of the names and flatten them into a single array
  const projectNameList = _.map(
    _.flattenDeep(_.values(allUsersProjectNames)),
    'name'
  )
  const uniqueName = ProjectHelper.ensureNameIsUnique(
    projectNameList,
    name,
    suffixes,
    MAX_PROJECT_NAME_LENGTH
  )
  return uniqueName
}

function fixProjectName(name) {
  // Remove any leading or trailing whitespace
  name = typeof name === 'string' ? name.trim() : ''
  // Apply a default name if the name is empty
  if (name === '') {
    name = 'Untitled'
  }
  if (name.indexOf('/') > -1) {
    // v2 does not allow / in a project name
    name = name.replace(/\//g, '-')
  }
  if (name.indexOf('\\') > -1) {
    // backslashes in project name will prevent syncing to dropbox
    name = name.replace(/\\/g, '')
  }
  if (name.length > MAX_PROJECT_NAME_LENGTH) {
    name = name.substr(0, MAX_PROJECT_NAME_LENGTH)
  }
  // Remove any leading or trailing whitespace after fixing
  name = name.trim()
  return name
}

async function setPublicAccessLevel(projectId, newAccessLevel) {
  if (
    projectId != null &&
    newAccessLevel != null &&
    _.includes(
      [PublicAccessLevels.PRIVATE, PublicAccessLevels.TOKEN_BASED],
      newAccessLevel
    )
  ) {
    await Project.updateOne(
      { _id: projectId },
      { publicAccesLevel: newAccessLevel }
    ).exec()
  } else {
    throw new Errors.InvalidError('unexpected access level')
  }
}

async function ensureTokensArePresent(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    tokens: 1,
  })
  if (
    project.tokens != null &&
    project.tokens.readOnly != null &&
    project.tokens.readAndWrite != null
  ) {
    return
  }
  await _generateTokens(project)
  await Project.updateOne(
    { _id: projectId },
    { $set: { tokens: project.tokens } }
  ).exec()
}

async function clearTokens(projectId) {
  await Project.updateOne(
    { _id: projectId },
    { $unset: { tokens: 1 }, $set: { publicAccesLevel: 'private' } }
  ).exec()
}

async function _generateTokens(project) {
  if (!project.tokens) {
    project.tokens = {}
  }
  const { tokens } = project
  if (tokens.readAndWrite == null) {
    const { token, numericPrefix } = TokenGenerator.readAndWriteToken()
    tokens.readAndWrite = token
    tokens.readAndWritePrefix = numericPrefix
  }
  if (tokens.readOnly == null) {
    tokens.readOnly =
      await TokenGenerator.promises.generateUniqueReadOnlyToken()
  }
}

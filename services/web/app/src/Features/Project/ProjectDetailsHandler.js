const _ = require('underscore')
const ProjectGetter = require('./ProjectGetter')
const UserGetter = require('../User/UserGetter')
const { Project } = require('../../models/Project')
const logger = require('logger-sharelatex')
const TpdsUpdateSender = require('../ThirdPartyDataStore/TpdsUpdateSender')
const PublicAccessLevels = require('../Authorization/PublicAccessLevels')
const Errors = require('../Errors/Errors')
const ProjectTokenGenerator = require('./ProjectTokenGenerator')
const ProjectEntityHandler = require('./ProjectEntityHandler')
const ProjectHelper = require('./ProjectHelper')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const settings = require('settings-sharelatex')
const { callbackify } = require('util')

const MAX_PROJECT_NAME_LENGTH = 150

module.exports = {
  MAX_PROJECT_NAME_LENGTH,
  getDetails: callbackify(getDetails),
  getProjectDescription: callbackify(getProjectDescription),
  setProjectDescription: callbackify(setProjectDescription),
  transferOwnership: callbackify(transferOwnership),
  renameProject: callbackify(renameProject),
  validateProjectName: callbackify(validateProjectName),
  generateUniqueName: callbackify(generateUniqueName),
  setPublicAccessLevel: callbackify(setPublicAccessLevel),
  ensureTokensArePresent: callbackify(ensureTokensArePresent),
  fixProjectName,
  promises: {
    getDetails,
    getProjectDescription,
    setProjectDescription,
    transferOwnership,
    renameProject,
    validateProjectName,
    generateUniqueName,
    setPublicAccessLevel,
    ensureTokensArePresent
  }
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
      overleaf: true
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
        : settings.defaultFeatures
  }
  if (project.overleaf != null) {
    details.overleaf = project.overleaf
  }
  logger.log({ projectId, details }, 'getting project details')
  return details
}

async function getProjectDescription(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    description: true
  })
  if (project == null) {
    return undefined
  }
  return project.description
}

async function setProjectDescription(projectId, description) {
  const conditions = { _id: projectId }
  const update = { description }
  logger.log(
    { conditions, update, projectId, description },
    'setting project description'
  )
  try {
    await Project.update(conditions, update).exec()
  } catch (err) {
    logger.warn({ err }, 'something went wrong setting project description')
    throw err
  }
}

async function transferOwnership(projectId, userId, suffix = '') {
  const project = await ProjectGetter.promises.getProject(projectId, {
    owner_ref: true,
    name: true
  })
  if (project == null) {
    throw new Errors.NotFoundError('project not found')
  }
  if (project.owner_ref === userId) {
    return
  }
  const user = await UserGetter.promises.getUser(userId)
  if (user == null) {
    throw new Errors.NotFoundError('user not found')
  }

  // we make sure the user to which the project is transferred is not a collaborator for the project,
  // this prevents any conflict during unique name generation
  await CollaboratorsHandler.promises.removeUserFromProject(projectId, userId)
  const name = await generateUniqueName(userId, project.name + suffix)
  await Project.update(
    { _id: projectId },
    {
      $set: {
        owner_ref: userId,
        name
      }
    }
  ).exec()
  await ProjectEntityHandler.promises.flushProjectToThirdPartyDataStore(
    projectId
  )
}

async function renameProject(projectId, newName) {
  await validateProjectName(newName)
  logger.log({ projectId, newName }, 'renaming project')
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
  await Project.update({ _id: projectId }, { name: newName }).exec()
  await TpdsUpdateSender.promises.moveEntity({
    project_id: projectId,
    project_name: oldProjectName,
    newProjectName: newName
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
}

// FIXME: we should put a lock around this to make it completely safe, but we would need to do that at
// the point of project creation, rather than just checking the name at the start of the import.
// If we later move this check into ProjectCreationHandler we can ensure all new projects are created
// with a unique name.  But that requires thinking through how we would handle incoming projects from
// dropbox for example.
async function generateUniqueName(userId, name, suffixes = []) {
  const allUsersProjectNames = await ProjectGetter.promises.findAllUsersProjects(
    userId,
    { name: 1 }
  )
  // allUsersProjectNames is returned as a hash {owned: [name1, name2, ...], readOnly: [....]}
  // collect all of the names and flatten them into a single array
  const projectNameList = _.pluck(
    _.flatten(_.values(allUsersProjectNames)),
    'name'
  )
  const uniqueName = await ProjectHelper.promises.ensureNameIsUnique(
    projectNameList,
    name,
    suffixes,
    MAX_PROJECT_NAME_LENGTH
  )
  return uniqueName
}

function fixProjectName(name) {
  if (name === '' || !name) {
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
  return name
}

async function setPublicAccessLevel(projectId, newAccessLevel) {
  logger.log({ projectId, level: newAccessLevel }, 'set public access level')
  // DEPRECATED: `READ_ONLY` and `READ_AND_WRITE` are still valid in, but should no longer
  // be passed here. Remove after token-based access has been live for a while
  if (
    projectId != null &&
    newAccessLevel != null &&
    _.include(
      [
        PublicAccessLevels.READ_ONLY,
        PublicAccessLevels.READ_AND_WRITE,
        PublicAccessLevels.PRIVATE,
        PublicAccessLevels.TOKEN_BASED
      ],
      newAccessLevel
    )
  ) {
    await Project.update(
      { _id: projectId },
      { publicAccesLevel: newAccessLevel }
    ).exec()
  }
}

async function ensureTokensArePresent(projectId) {
  const project = await ProjectGetter.promises.getProject(projectId, {
    tokens: 1
  })
  if (
    project.tokens != null &&
    project.tokens.readOnly != null &&
    project.tokens.readAndWrite != null
  ) {
    logger.log({ projectId }, 'project already has tokens')
    return project.tokens
  }
  const hasTokens = project.tokens != null
  const hasReadOnly = hasTokens && project.tokens.readOnly != null
  const hasReadAndWrite = hasTokens && project.tokens.readAndWrite != null
  logger.log(
    { projectId, hasTokens, hasReadOnly, hasReadAndWrite },
    'generating tokens for project'
  )
  await _generateTokens(project)
  await Project.update(
    { _id: projectId },
    { $set: { tokens: project.tokens } }
  ).exec()
  return project.tokens
}

async function _generateTokens(project, callback) {
  if (!project.tokens) {
    project.tokens = {}
  }
  const { tokens } = project
  if (tokens.readAndWrite == null) {
    const { token, numericPrefix } = ProjectTokenGenerator.readAndWriteToken()
    tokens.readAndWrite = token
    tokens.readAndWritePrefix = numericPrefix
  }
  if (tokens.readOnly == null) {
    tokens.readOnly = await ProjectTokenGenerator.promises.generateUniqueReadOnlyToken()
  }
}

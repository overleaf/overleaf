const ProjectDeleter = require('../Project/ProjectDeleter')
const EditorController = require('./EditorController')
const ProjectGetter = require('../Project/ProjectGetter')
const AuthorizationManager = require('../Authorization/AuthorizationManager')
const ProjectEditorHandler = require('../Project/ProjectEditorHandler')
const Metrics = require('@overleaf/metrics')
const CollaboratorsGetter = require('../Collaborators/CollaboratorsGetter')
const CollaboratorsInviteHandler = require('../Collaborators/CollaboratorsInviteHandler')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const TokenAccessHandler = require('../TokenAccess/TokenAccessHandler')
const AuthenticationController = require('../Authentication/AuthenticationController')
const Errors = require('../Errors/Errors')
const HttpErrorHandler = require('../Errors/HttpErrorHandler')
const ProjectEntityUpdateHandler = require('../Project/ProjectEntityUpdateHandler')
const { expressify } = require('../../util/promises')

module.exports = {
  joinProject: expressify(joinProject),
  addDoc: expressify(addDoc),
  addFolder: expressify(addFolder),
  renameEntity: expressify(renameEntity),
  moveEntity: expressify(moveEntity),
  deleteDoc: expressify(deleteDoc),
  deleteFile: expressify(deleteFile),
  deleteFolder: expressify(deleteFolder),
  deleteEntity: expressify(deleteEntity),
  convertDocToFile: expressify(convertDocToFile),
  _nameIsAcceptableLength
}

const unsupportedSpellcheckLanguages = [
  'am',
  'hy',
  'bn',
  'gu',
  'he',
  'hi',
  'hu',
  'is',
  'kn',
  'ml',
  'mr',
  'or',
  'ss',
  'ta',
  'te',
  'uk',
  'uz',
  'zu',
  'fi'
]

async function joinProject(req, res, next) {
  const projectId = req.params.Project_id
  let userId = req.query.user_id
  if (userId === 'anonymous-user') {
    userId = null
  }
  Metrics.inc('editor.join-project')
  const {
    project,
    privilegeLevel,
    isRestrictedUser
  } = await _buildJoinProjectView(req, projectId, userId)
  if (!project) {
    return res.sendStatus(403)
  }
  // Hide access tokens if this is not the project owner
  TokenAccessHandler.protectTokens(project, privilegeLevel)
  // Hide sensitive data if the user is restricted
  if (isRestrictedUser) {
    project.owner = { _id: project.owner._id }
    project.members = []
  }
  // Only show the 'renamed or deleted' message once
  if (project.deletedByExternalDataSource) {
    await ProjectDeleter.promises.unmarkAsDeletedByExternalSource(projectId)
  }
  // disable spellchecking for currently unsupported spell check languages
  // preserve the value in the db so they can use it again once we add back
  // support.
  if (
    unsupportedSpellcheckLanguages.indexOf(project.spellCheckLanguage) !== -1
  ) {
    project.spellCheckLanguage = ''
  }
  res.json({
    project,
    privilegeLevel,
    isRestrictedUser
  })
}

async function _buildJoinProjectView(req, projectId, userId) {
  const project = await ProjectGetter.promises.getProjectWithoutDocLines(
    projectId
  )
  if (project == null) {
    throw new Errors.NotFoundError('project not found')
  }
  const members = await CollaboratorsGetter.promises.getInvitedMembersWithPrivilegeLevels(
    projectId
  )
  const token = TokenAccessHandler.getRequestToken(req, projectId)
  const privilegeLevel = await AuthorizationManager.promises.getPrivilegeLevelForProject(
    userId,
    projectId,
    token
  )
  if (privilegeLevel == null || privilegeLevel === PrivilegeLevels.NONE) {
    return { project: null, privilegeLevel: null, isRestrictedUser: false }
  }
  const invites = await CollaboratorsInviteHandler.promises.getAllInvites(
    projectId
  )
  const isTokenMember = await CollaboratorsHandler.promises.userIsTokenMember(
    userId,
    projectId
  )
  const isRestrictedUser = AuthorizationManager.isRestrictedUser(
    userId,
    privilegeLevel,
    isTokenMember
  )
  return {
    project: ProjectEditorHandler.buildProjectModelView(
      project,
      members,
      invites
    ),
    privilegeLevel,
    isRestrictedUser
  }
}

function _nameIsAcceptableLength(name) {
  return name != null && name.length < 150 && name.length !== 0
}

async function addDoc(req, res, next) {
  const projectId = req.params.Project_id
  const { name } = req.body
  const parentFolderId = req.body.parent_folder_id
  const userId = AuthenticationController.getLoggedInUserId(req)

  if (!_nameIsAcceptableLength(name)) {
    return res.sendStatus(400)
  }
  try {
    const doc = await EditorController.promises.addDoc(
      projectId,
      parentFolderId,
      name,
      [],
      'editor',
      userId
    )
    res.json(doc)
  } catch (err) {
    if (err.message === 'project_has_too_many_files') {
      res.status(400).json(req.i18n.translate('project_has_too_many_files'))
    } else {
      next(err)
    }
  }
}

async function addFolder(req, res, next) {
  const projectId = req.params.Project_id
  const { name } = req.body
  const parentFolderId = req.body.parent_folder_id
  const userId = AuthenticationController.getLoggedInUserId(req)
  if (!_nameIsAcceptableLength(name)) {
    return res.sendStatus(400)
  }
  try {
    const doc = await EditorController.promises.addFolder(
      projectId,
      parentFolderId,
      name,
      'editor',
      userId
    )
    res.json(doc)
  } catch (err) {
    if (err.message === 'project_has_too_many_files') {
      res.status(400).json(req.i18n.translate('project_has_too_many_files'))
    } else if (err.message === 'invalid element name') {
      res.status(400).json(req.i18n.translate('invalid_file_name'))
    } else {
      next(err)
    }
  }
}

async function renameEntity(req, res, next) {
  const projectId = req.params.Project_id
  const entityId = req.params.entity_id
  const entityType = req.params.entity_type
  const { name } = req.body
  if (!_nameIsAcceptableLength(name)) {
    return res.sendStatus(400)
  }
  const userId = AuthenticationController.getLoggedInUserId(req)
  await EditorController.promises.renameEntity(
    projectId,
    entityId,
    entityType,
    name,
    userId
  )
  res.sendStatus(204)
}

async function moveEntity(req, res, next) {
  const projectId = req.params.Project_id
  const entityId = req.params.entity_id
  const entityType = req.params.entity_type
  const folderId = req.body.folder_id
  const userId = AuthenticationController.getLoggedInUserId(req)
  await EditorController.promises.moveEntity(
    projectId,
    entityId,
    folderId,
    entityType,
    userId
  )
  res.sendStatus(204)
}

async function deleteDoc(req, res, next) {
  req.params.entity_type = 'doc'
  await deleteEntity(req, res, next)
}

async function deleteFile(req, res, next) {
  req.params.entity_type = 'file'
  await deleteEntity(req, res, next)
}

async function deleteFolder(req, res, next) {
  req.params.entity_type = 'folder'
  await deleteEntity(req, res, next)
}

async function deleteEntity(req, res, next) {
  const projectId = req.params.Project_id
  const entityId = req.params.entity_id
  const entityType = req.params.entity_type
  const userId = AuthenticationController.getLoggedInUserId(req)
  await EditorController.promises.deleteEntity(
    projectId,
    entityId,
    entityType,
    'editor',
    userId
  )
  res.sendStatus(204)
}

async function convertDocToFile(req, res, next) {
  const projectId = req.params.Project_id
  const docId = req.params.entity_id
  const { userId } = req.body
  try {
    const fileRef = await ProjectEntityUpdateHandler.promises.convertDocToFile(
      projectId,
      docId,
      userId
    )
    res.json({ fileId: fileRef._id.toString() })
  } catch (err) {
    if (err instanceof Errors.NotFoundError) {
      return HttpErrorHandler.notFound(req, res, 'Document not found')
    } else if (err instanceof Errors.DocHasRangesError) {
      return HttpErrorHandler.unprocessableEntity(
        req,
        res,
        'Document has comments or tracked changes'
      )
    } else {
      throw err
    }
  }
}

const ProjectDeleter = require('../Project/ProjectDeleter')
const EditorController = require('./EditorController')
const ProjectGetter = require('../Project/ProjectGetter')
const AuthorizationManager = require('../Authorization/AuthorizationManager')
const ProjectEditorHandler = require('../Project/ProjectEditorHandler')
const Metrics = require('@overleaf/metrics')
const CollaboratorsGetter = require('../Collaborators/CollaboratorsGetter')
const CollaboratorsInviteGetter = require('../Collaborators/CollaboratorsInviteGetter')
const CollaboratorsHandler = require('../Collaborators/CollaboratorsHandler')
const PrivilegeLevels = require('../Authorization/PrivilegeLevels')
const SessionManager = require('../Authentication/SessionManager')
const Errors = require('../Errors/Errors')
const DocstoreManager = require('../Docstore/DocstoreManager')
const logger = require('@overleaf/logger')
const { expressify } = require('@overleaf/promise-utils')
const Settings = require('@overleaf/settings')

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
  _nameIsAcceptableLength,
}

async function joinProject(req, res, next) {
  const projectId = req.params.Project_id
  let userId = req.body.userId // keep schema in sync with router
  if (userId === 'anonymous-user') {
    userId = null
  }
  Metrics.inc('editor.join-project')
  const {
    project,
    privilegeLevel,
    isRestrictedUser,
    isTokenMember,
    isInvitedMember,
  } = await _buildJoinProjectView(req, projectId, userId)
  if (!project) {
    return res.sendStatus(403)
  }
  // Hide sensitive data if the user is restricted
  if (isRestrictedUser) {
    project.owner = { _id: project.owner._id }
    project.members = []
    project.invites = []
  }
  // Only show the 'renamed or deleted' message once
  if (project.deletedByExternalDataSource) {
    await ProjectDeleter.promises.unmarkAsDeletedByExternalSource(projectId)
  }

  if (project.spellCheckLanguage) {
    project.spellCheckLanguage = await chooseSpellCheckLanguage(
      project.spellCheckLanguage
    )
  }

  res.json({
    project,
    privilegeLevel,
    isRestrictedUser,
    isTokenMember,
    isInvitedMember,
  })
}

async function _buildJoinProjectView(req, projectId, userId) {
  const project =
    await ProjectGetter.promises.getProjectWithoutDocLines(projectId)
  if (project == null) {
    throw new Errors.NotFoundError('project not found')
  }
  let deletedDocsFromDocstore = []
  try {
    deletedDocsFromDocstore =
      await DocstoreManager.promises.getAllDeletedDocs(projectId)
  } catch (err) {
    // The query in docstore is not optimized at this time and fails for
    // projects with many very large, deleted documents.
    // Not serving the user with deletedDocs from docstore may cause a minor
    //  UI issue with deleted files that are no longer available for restore.
    logger.warn(
      { err, projectId },
      'soft-failure when fetching deletedDocs from docstore'
    )
  }
  const members =
    await CollaboratorsGetter.promises.getInvitedMembersWithPrivilegeLevels(
      projectId
    )
  const token = req.body.anonymousAccessToken
  const privilegeLevel =
    await AuthorizationManager.promises.getPrivilegeLevelForProject(
      userId,
      projectId,
      token
    )
  if (privilegeLevel == null || privilegeLevel === PrivilegeLevels.NONE) {
    return { project: null, privilegeLevel: null, isRestrictedUser: false }
  }
  const invites =
    await CollaboratorsInviteGetter.promises.getAllInvites(projectId)
  const isTokenMember = await CollaboratorsHandler.promises.userIsTokenMember(
    userId,
    projectId
  )
  const isInvitedMember =
    await CollaboratorsGetter.promises.isUserInvitedMemberOfProject(
      userId,
      projectId
    )
  const isRestrictedUser = AuthorizationManager.isRestrictedUser(
    userId,
    privilegeLevel,
    isTokenMember,
    isInvitedMember
  )
  return {
    project: ProjectEditorHandler.buildProjectModelView(
      project,
      members,
      invites,
      deletedDocsFromDocstore
    ),
    privilegeLevel,
    isTokenMember,
    isInvitedMember,
    isRestrictedUser,
  }
}

function _nameIsAcceptableLength(name) {
  return name != null && name.length < 150 && name.length !== 0
}

async function addDoc(req, res, next) {
  const projectId = req.params.Project_id
  const { name } = req.body
  const parentFolderId = req.body.parent_folder_id
  const userId = SessionManager.getLoggedInUserId(req.session)

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
  const userId = SessionManager.getLoggedInUserId(req.session)
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
  const { name, source = 'editor' } = req.body
  if (!_nameIsAcceptableLength(name)) {
    return res.sendStatus(400)
  }
  const userId = SessionManager.getLoggedInUserId(req.session)
  await EditorController.promises.renameEntity(
    projectId,
    entityId,
    entityType,
    name,
    userId,
    source
  )
  res.sendStatus(204)
}

async function moveEntity(req, res, next) {
  const projectId = req.params.Project_id
  const entityId = req.params.entity_id
  const entityType = req.params.entity_type
  const folderId = req.body.folder_id
  const source = req.body.source ?? 'editor'
  const userId = SessionManager.getLoggedInUserId(req.session)
  await EditorController.promises.moveEntity(
    projectId,
    entityId,
    folderId,
    entityType,
    userId,
    source
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
  const userId = SessionManager.getLoggedInUserId(req.session)
  await EditorController.promises.deleteEntity(
    projectId,
    entityId,
    entityType,
    'editor',
    userId
  )
  res.sendStatus(204)
}

const supportedSpellCheckLanguages = new Set(
  Settings.languages
    // only include spell-check languages that are available in the client
    .filter(language => language.dic !== undefined)
    .map(language => language.code)
)

async function chooseSpellCheckLanguage(spellCheckLanguage) {
  if (supportedSpellCheckLanguages.has(spellCheckLanguage)) {
    return spellCheckLanguage
  }

  // Preserve the value in the database so they can use it again once we add back support.
  // Map some server-only languages to a specific variant, or disable spell checking for currently unsupported spell check languages.
  switch (spellCheckLanguage) {
    case 'en':
      // map "English" to "English (American)"
      return 'en_US'

    case 'no':
      // map "Norwegian" to "Norwegian (Bokmål)"
      return 'nb_NO'

    default:
      // map anything else to "off"
      return ''
  }
}

import ProjectDeleter from '../Project/ProjectDeleter.mjs'
import EditorController from './EditorController.mjs'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import AuthorizationManager from '../Authorization/AuthorizationManager.mjs'
import ProjectEditorHandler from '../Project/ProjectEditorHandler.mjs'
import Metrics from '@overleaf/metrics'
import CollaboratorsInviteGetter from '../Collaborators/CollaboratorsInviteGetter.mjs'
import PrivilegeLevels from '../Authorization/PrivilegeLevels.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import Errors from '../Errors/Errors.js'
import { expressify } from '@overleaf/promise-utils'
import Settings from '@overleaf/settings'
import CollaboratorsGetter from '../Collaborators/CollaboratorsGetter.mjs'
import { z, zz, parseReq } from '../../infrastructure/Validation.mjs'

const ProjectAccess = CollaboratorsGetter.ProjectAccess

export default {
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

const joinProjectSchema = z.object({
  params: z.object({
    Project_id: zz.objectId(),
  }),
  body: z.object({
    userId: z.string(),
    anonymousAccessToken: z.string().optional(),
  }),
})

async function joinProject(req, res, next) {
  const { params, body } = parseReq(req, joinProjectSchema)
  const projectId = params.Project_id
  let userId = body.userId
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
  const projectAccess = new ProjectAccess(project)
  const token = req.body.anonymousAccessToken
  const privilegeLevel =
    await AuthorizationManager.promises.getPrivilegeLevelForProjectWithProjectAccess(
      userId,
      projectId,
      token,
      projectAccess
    )
  if (privilegeLevel == null || privilegeLevel === PrivilegeLevels.NONE) {
    return { project: null, privilegeLevel: null, isRestrictedUser: false }
  }
  const isTokenMember = projectAccess.isUserTokenMember(userId)
  const isInvitedMember = projectAccess.isUserInvitedMember(userId)
  const isRestrictedUser = AuthorizationManager.isRestrictedUser(
    userId,
    privilegeLevel,
    isTokenMember,
    isInvitedMember
  )
  let ownerMember
  let members = []
  let invites = []
  if (isRestrictedUser) {
    ownerMember = await projectAccess.loadOwner()
  } else {
    ;({ ownerMember, members } =
      await projectAccess.loadOwnerAndInvitedMembers())
    invites = await CollaboratorsInviteGetter.promises.getAllInvites(projectId)
  }
  return {
    project: ProjectEditorHandler.buildProjectModelView(
      project,
      ownerMember,
      members,
      invites,
      isRestrictedUser
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
      res.status(400).json(
        req.i18n.translate('project_has_too_many_files_limit', {
          limit: Settings.maxEntitiesPerProject,
        })
      )
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
      res.status(400).json(
        req.i18n.translate('project_has_too_many_files_limit', {
          limit: Settings.maxEntitiesPerProject,
        })
      )
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

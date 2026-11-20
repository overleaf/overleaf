import _ from 'lodash'
import { expressify } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'
import { Project } from '../../models/Project.mjs'
import { User } from '../../models/User.mjs'
import Features from '../../infrastructure/Features.mjs'
import SessionManager from '../Authentication/SessionManager.mjs'
import AuthorizationManager from './AuthorizationManager.mjs'
import CollaboratorsGetter from '../Collaborators/CollaboratorsGetter.mjs'
import CollaboratorsInviteGetter from '../Collaborators/CollaboratorsInviteGetter.mjs'
import ProjectEditorHandler from '../Project/ProjectEditorHandler.mjs'
import { parseReq, z, zz } from '../../infrastructure/Validation.mjs'
import ProjectAccessPolicyService from './ProjectAccessPolicyService.mjs'

const projectParamsSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
})

const userSearchQuerySchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
  query: z.object({
    q: z.string().max(120).optional(),
  }),
})

const addCollaboratorBodySchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
  }),
  body: z.strictObject({
    userId: zz.objectId().optional(),
    email: z.string().trim().max(254).optional(),
    permissionMode: z.enum(['edit', 'copy', 'view_only']),
  }),
})

const updateCollaboratorSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    userId: zz.objectId(),
  }),
  body: z.strictObject({
    permissionMode: z.enum(['edit', 'copy', 'view_only']),
  }),
})

const removeCollaboratorParamsSchema = z.object({
  params: z.strictObject({
    Project_id: zz.objectId(),
    userId: zz.objectId(),
  }),
})

function sendSharingError(res, err, fallbackMessage) {
  if (
    err?.name === 'InvalidRequestError' ||
    err?.name === 'InvalidParamsError'
  ) {
    return res.status(400).json({
      message: 'Please check your sharing request and try again',
    })
  }
  const status = err?.statusCode || 500
  if (status >= 500) {
    logger.error({ err }, fallbackMessage)
  }
  return res.status(status).json({
    message: status < 500 ? err.message : fallbackMessage,
  })
}

const ProjectSharingController = {
  getProjectSharing: expressify(async (req, res) => {
    try {
      const { params } = parseReq(req, projectParamsSchema)
      const projectId = params.Project_id
      const userId = SessionManager.getLoggedInUserId(req.session)

      const [project, currentUserDoc] = await Promise.all([
        Project.findById(projectId, {
          ...CollaboratorsGetter.ProjectAccess.PROJECTION,
          _id: 1,
          name: 1,
          enterpriseAccess: 1,
        }).lean(),
        userId ? User.findById(userId, { isAdmin: 1 }).lean() : null,
      ])

      if (!project) {
        return res.status(404).json({ message: 'Project not found' })
      }

      const projectAccess = new CollaboratorsGetter.ProjectAccess(project)
      const privilegeLevel =
        await AuthorizationManager.promises.getPrivilegeLevelForProjectWithProjectAccess(
          userId,
          projectId,
          null,
          projectAccess
        )
      const isProjectOwner = Boolean(
        userId &&
          project.owner_ref &&
          String(project.owner_ref) === String(userId)
      )
      const isSiteAdmin = Boolean(currentUserDoc?.isAdmin)
      const canAdminProject = isProjectOwner || isSiteAdmin

      const isTokenMember = userId
        ? projectAccess.isUserTokenMember(userId)
        : false
      const isInvitedMember = userId
        ? projectAccess.isUserInvitedMember(userId)
        : false
      const isRestrictedUser =
        !canAdminProject &&
        AuthorizationManager.isRestrictedUser(
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

      const accessRequestData = {}
      if (canAdminProject) {
        accessRequestData.editAccessRequests =
          await projectAccess.loadAccessRequestsView()
      } else if (userId) {
        accessRequestData.myAccessRequest =
          projectAccess.getAccessRequestForUser(userId)
      }

      const collaborators =
        isRestrictedUser
          ? []
          : await ProjectAccessPolicyService.getProjectCollaboratorsSummary(
              project
            )
      const enterpriseAccess =
        ProjectAccessPolicyService.buildEnterpriseAccessView(project)
      const canCopy = userId
        ? await ProjectAccessPolicyService.canUserCopyProject(userId, projectId)
        : false

      const ownerView = isRestrictedUser
        ? { _id: project.owner_ref }
        : ownerMember
          ? ProjectEditorHandler.buildUserModelView(ownerMember)
          : {
              _id: project.owner_ref,
              email: '',
              first_name: '',
              last_name: '',
              privileges: 'owner',
              allowCopy: true,
              signUpDate: '',
            }

      const features = _.defaults(ownerMember?.user?.features || {}, {
        collaborators: -1,
        versioning: false,
        dropbox: false,
        compileTimeout: 60,
        compileGroup: 'standard',
        templates: false,
        references: false,
        referencesSearch: false,
        mendeley: false,
        trackChanges: false,
        trackChangesVisible: ProjectEditorHandler.trackChangesAvailable,
        symbolPalette: false,
      })

      res.json({
        project: {
          id: String(project._id),
          name: project.name,
        },
        collaborators,
        enterprisePolicySummary: enterpriseAccess,
        isProjectOwner,
        canAdminProject,
        isRestrictedTokenMember: isRestrictedUser,
        projectMetadata: {
          _id: String(project._id),
          name: project.name,
          publicAccessLevel: project.publicAccesLevel || 'private',
          owner: ownerView,
          members: isRestrictedUser
            ? []
            : members.map(m => ProjectEditorHandler.buildUserModelView(m)),
          invites: isRestrictedUser
            ? []
            : ProjectEditorHandler.buildInvitesView(invites),
          ...(accessRequestData.editAccessRequests !== undefined
            ? { editAccessRequests: accessRequestData.editAccessRequests }
            : {}),
          ...(accessRequestData.myAccessRequest !== undefined
            ? { myAccessRequest: accessRequestData.myAccessRequest }
            : {}),
          features,
          linkSharingEnabled: Features.hasFeature('link-sharing'),
          canCopy,
          enterpriseAccess,
        },
      })
    } catch (err) {
      sendSharingError(res, err, 'Failed to load project sharing settings')
    }
  }),

  searchUsers: expressify(async (req, res) => {
    try {
      const { params, query } = parseReq(req, userSearchQuerySchema)
      const project = await Project.findById(params.Project_id, {
        owner_ref: 1,
        collaberator_refs: 1,
        reviewer_refs: 1,
        readOnly_refs: 1,
      }).lean()

      if (!project) {
        return res.status(404).json({ message: 'Project not found' })
      }

      const excludeIds = [
        project.owner_ref,
        ...(project.collaberator_refs || []),
        ...(project.reviewer_refs || []),
        ...(project.readOnly_refs || []),
      ]
        .filter(Boolean)
        .map(String)

      const users =
        await ProjectAccessPolicyService.searchWorkspaceUsersForSharing(
          query.q || '',
          excludeIds,
          15
        )
      res.json({ users })
    } catch (err) {
      sendSharingError(res, err, 'Failed to search workspace users')
    }
  }),

  addCollaborator: expressify(async (req, res) => {
    try {
      const { params, body } = parseReq(req, addCollaboratorBodySchema)
      if (!body.userId && !body.email) {
        return res.status(400).json({
          message: 'Select a workspace user to share this project with',
        })
      }

      const actingUserId = SessionManager.getLoggedInUserId(req.session)
      const collaborators =
        await ProjectAccessPolicyService.upsertDirectCollaborator(
          params.Project_id,
          actingUserId,
          {
            userId: body.userId,
            email: body.email,
            permissionMode: body.permissionMode,
          }
        )
      res.status(201).json({ ok: true, collaborators })
    } catch (err) {
      sendSharingError(res, err, 'Failed to share project with user')
    }
  }),

  updateCollaborator: expressify(async (req, res) => {
    try {
      const { params, body } = parseReq(req, updateCollaboratorSchema)
      const actingUserId = SessionManager.getLoggedInUserId(req.session)
      const collaborators =
        await ProjectAccessPolicyService.upsertDirectCollaborator(
          params.Project_id,
          actingUserId,
          {
            userId: params.userId,
            permissionMode: body.permissionMode,
          }
        )
      res.json({ ok: true, collaborators })
    } catch (err) {
      sendSharingError(res, err, 'Failed to update collaborator permissions')
    }
  }),

  removeCollaborator: expressify(async (req, res) => {
    try {
      const { params } = parseReq(req, removeCollaboratorParamsSchema)
      const collaborators =
        await ProjectAccessPolicyService.removeDirectCollaborator(
          params.Project_id,
          params.userId
        )
      res.json({ ok: true, collaborators })
    } catch (err) {
      sendSharingError(res, err, 'Failed to remove collaborator')
    }
  }),
}

export default ProjectSharingController

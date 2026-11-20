import { expressify } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'
import SessionManager from '../Authentication/SessionManager.mjs'
import EditorRealTimeController from '../Editor/EditorRealTimeController.mjs'
import TpdsProjectFlusher from '../ThirdPartyDataStore/TpdsProjectFlusher.mjs'
import TpdsUpdateSender from '../ThirdPartyDataStore/TpdsUpdateSender.mjs'
import UserGetter from '../User/UserGetter.mjs'
import { parseReq, z, zz } from '../../infrastructure/Validation.mjs'
import AdminService from './AdminService.mjs'
import WorkspaceBrandingService from './WorkspaceBrandingService.mjs'

const closeEditorSchema = z.object({
  body: z.strictObject({
    isOpen: z.coerce.boolean().optional(),
    _csrf: z.string().optional(),
  }),
})

const disconnectAllUsersSchema = z.object({
  query: z.object({
    delay: z.coerce.number().optional(),
  }),
  body: z
    .object({
      delay: z.coerce.number().optional(),
      _csrf: z.string().optional(),
    })
    .optional(),
})

const setEditorStatusSchema = z.object({
  body: z.strictObject({
    isOpen: z.boolean(),
  }),
})

const createMessageSchema = z.object({
  body: z.strictObject({
    content: z.string().min(1).max(500),
    _csrf: z.string().optional(),
  }),
})

const deleteMessageParamsSchema = z.object({
  params: z.object({
    messageId: zz.objectId(),
  }),
})

const listUsersQuerySchema = z.object({
  query: z.object({
    search: z.string().max(120).optional(),
    filter: z.enum(['all', 'admins', 'active', 'suspended']).optional(),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
})

const createUserBodySchema = z.object({
  body: z.strictObject({
    email: z.string().trim().min(3).max(254),
    password: z.string().max(256).optional(),
    fullName: z.string().max(255).optional(),
    first_name: z.string().max(255).optional(),
    last_name: z.string().max(255).optional(),
    role: z.string().max(120).optional(),
    institution: z.string().max(160).optional(),
    isAdmin: z.boolean().optional(),
  }),
})

const userParamsSchema = z.object({
  params: z.object({
    userId: zz.objectId(),
  }),
})

const updateUserSchema = z.object({
  params: z.object({
    userId: zz.objectId(),
  }),
  body: z.strictObject({
    first_name: z.string().max(255).optional(),
    last_name: z.string().max(255).optional(),
    role: z.string().max(120).optional(),
    institution: z.string().max(160).optional(),
    password: z.string().max(256).optional(),
    isAdmin: z.boolean().optional(),
    suspended: z.boolean().optional(),
  }),
})

const flushProjectToTpdsSchema = z.object({
  body: z.object({
    project_id: zz.objectId(),
  }),
})

const pollDropboxForUserSchema = z.object({
  body: z.object({
    user_id: zz.objectId(),
  }),
})

const listProjectsQuerySchema = z.object({
  query: z.object({
    search: z.string().max(120).optional(),
    filter: z
      .enum(['all', 'enterprise', 'user_shared', 'private'])
      .optional(),
    page: z.coerce.number().int().min(1).max(10000).optional(),
    limit: z.coerce.number().int().min(1).max(100).optional(),
  }),
})

const updateProjectAccessSchema = z.object({
  params: z.object({
    projectId: zz.objectId(),
  }),
  body: z.strictObject({
    scope: z.enum(['private', 'network', 'all_users', 'custom']),
    permissionMode: z.enum(['edit', 'copy', 'view_only']),
    networkOnly: z.boolean().optional(),
    allowedCidrs: z.array(z.string().max(64)).max(50).optional(),
    targetRoles: z.array(z.string().max(120)).max(50).optional(),
    targetInstitutions: z.array(z.string().max(160)).max(50).optional(),
    targetUserIds: z.array(zz.objectId()).max(100).optional(),
  }),
})

const projectAccessParamsSchema = z.object({
  params: z.object({
    projectId: zz.objectId(),
  }),
})

const addProjectCollaboratorSchema = z.object({
  params: z.object({
    projectId: zz.objectId(),
  }),
  body: z.strictObject({
    userId: zz.objectId().optional(),
    email: z.string().trim().max(254).optional(),
    permissionMode: z.enum(['edit', 'copy', 'view_only']),
  }),
})

const projectCollaboratorParamsSchema = z.object({
  params: z.object({
    projectId: zz.objectId(),
    userId: zz.objectId(),
  }),
})

const updateProjectCollaboratorSchema = z.object({
  params: z.object({
    projectId: zz.objectId(),
    userId: zz.objectId(),
  }),
  body: z.strictObject({
    permissionMode: z.enum(['edit', 'copy', 'view_only']),
  }),
})

const updateBrandingSchema = z.object({
  body: z.strictObject({
    organizationName: z.string().max(120).optional(),
    logoDataUrl: z.string().max(750000).optional(),
    logoDarkDataUrl: z.string().max(750000).optional(),
    clearLogo: z.boolean().optional(),
    clearLogoDark: z.boolean().optional(),
  }),
})

function sendAdminError(res, err, fallbackMessage) {
  if (err?.name === 'InvalidRequestError' || err?.name === 'InvalidParamsError') {
    return res.status(400).json({
      message: 'Please check your input and try again',
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

async function renderAdminPage(req, res, initialTab) {
  const sessionUser = SessionManager.getSessionUser(req.session)
  const dbUser = sessionUser?._id
    ? await UserGetter.promises.getUser(sessionUser._id, {
        _id: 1,
        email: 1,
        first_name: 1,
        last_name: 1,
        isAdmin: 1,
      })
    : null

  res.render('admin/index', {
    title:
      initialTab === 'users'
        ? 'Manage Users'
        : initialTab === 'projects'
          ? 'Shared Projects'
          : 'System Admin',
    initialTab,
    showThinFooter: true,
    user: {
      id: String(dbUser?._id || sessionUser?._id || ''),
      email: dbUser?.email || sessionUser?.email || '',
      first_name: dbUser?.first_name || '',
      last_name: dbUser?.last_name || '',
      isAdmin: Boolean(dbUser?.isAdmin ?? sessionUser?.isAdmin),
    },
  })
}

const AdminController = {
  _sendDisconnectAllUsersMessage: delay => {
    return EditorRealTimeController.emitToAll(
      'forceDisconnect',
      'The administrator is performing maintenance on the editor. Please refresh the page shortly to continue.',
      delay
    )
  },

  index: expressify(async (req, res) => {
    await renderAdminPage(req, res, 'overview')
  }),

  usersPage: expressify(async (req, res) => {
    await renderAdminPage(req, res, 'users')
  }),

  projectsPage: expressify(async (req, res) => {
    await renderAdminPage(req, res, 'projects')
  }),

  getOverview: expressify(async (_req, res) => {
    try {
      const overview = await AdminService.getSystemOverview()
      res.json(overview)
    } catch (err) {
      sendAdminError(res, err, 'Failed to load system admin overview')
    }
  }),

  setEditorStatus(req, res) {
    try {
      const { body } = parseReq(req, setEditorStatusSchema)
      const result = AdminService.setEditorOpen(body.isOpen)
      res.json({ ok: true, ...result })
    } catch (err) {
      sendAdminError(res, err, 'Failed to update editor maintenance state')
    }
  },

  disconnectAllUsersJson(req, res) {
    try {
      const { body } = parseReq(req, disconnectAllUsersSchema)
      const result = AdminService.disconnectAllUsers(body?.delay ?? 10)
      res.json({ ok: true, ...result })
    } catch (err) {
      sendAdminError(res, err, 'Failed to disconnect active editor sessions')
    }
  },

  createMessageJson: expressify(async (req, res) => {
    try {
      const { body } = parseReq(req, createMessageSchema)
      const systemMessages = await AdminService.createSystemMessage(body.content)
      res.status(201).json({ ok: true, systemMessages })
    } catch (err) {
      sendAdminError(res, err, 'Failed to create system announcement')
    }
  }),

  deleteMessageJson: expressify(async (req, res) => {
    try {
      const { params } = parseReq(req, deleteMessageParamsSchema)
      const systemMessages = await AdminService.deleteSystemMessage(
        params.messageId
      )
      res.json({ ok: true, systemMessages })
    } catch (err) {
      sendAdminError(res, err, 'Failed to delete system announcement')
    }
  }),

  clearMessagesJson: expressify(async (_req, res) => {
    try {
      const systemMessages = await AdminService.clearSystemMessages()
      res.json({ ok: true, systemMessages })
    } catch (err) {
      sendAdminError(res, err, 'Failed to clear system announcements')
    }
  }),

  listUsers: expressify(async (req, res) => {
    try {
      const { query } = parseReq(req, listUsersQuerySchema)
      const result = await AdminService.listUsers(query)
      res.json(result)
    } catch (err) {
      sendAdminError(res, err, 'Failed to list workspace users')
    }
  }),

  createUser: expressify(async (req, res) => {
    try {
      const { body } = parseReq(req, createUserBodySchema)
      const result = await AdminService.createUser({
        email: body.email,
        password: body.password,
        fullName: body.fullName,
        firstName: body.first_name,
        lastName: body.last_name,
        role: body.role,
        institution: body.institution,
        isAdmin: body.isAdmin,
      })
      res.status(201).json({ ok: true, ...result })
    } catch (err) {
      sendAdminError(res, err, 'Failed to create user')
    }
  }),

  updateUser: expressify(async (req, res) => {
    try {
      const { params, body } = parseReq(req, updateUserSchema)
      const actingAdminId = SessionManager.getLoggedInUserId(req.session)
      const user = await AdminService.updateUser(
        params.userId,
        actingAdminId,
        body
      )
      res.json({ ok: true, user })
    } catch (err) {
      sendAdminError(res, err, 'Failed to update user')
    }
  }),

  generateResetLink: expressify(async (req, res) => {
    try {
      const { params } = parseReq(req, userParamsSchema)
      const result = await AdminService.generatePasswordResetLink(params.userId)
      res.json({ ok: true, ...result })
    } catch (err) {
      sendAdminError(res, err, 'Failed to generate password reset link')
    }
  }),

  deleteUser: expressify(async (req, res) => {
    try {
      const { params } = parseReq(req, userParamsSchema)
      const actingAdmin = SessionManager.getSessionUser(req.session)
      await AdminService.deleteUser(params.userId, actingAdmin, req.ip)
      res.json({ ok: true })
    } catch (err) {
      sendAdminError(res, err, 'Failed to delete user')
    }
  }),

  listProjects: expressify(async (req, res) => {
    try {
      const { query } = parseReq(req, listProjectsQuerySchema)
      const result = await AdminService.listProjectsWithAccess(query)
      res.json(result)
    } catch (err) {
      sendAdminError(res, err, 'Failed to load workspace project access list')
    }
  }),

  getProjectAccess: expressify(async (req, res) => {
    try {
      const { params } = parseReq(req, projectAccessParamsSchema)
      const result = await AdminService.getProjectAccessDetails(params.projectId)
      res.json(result)
    } catch (err) {
      sendAdminError(res, err, 'Failed to load project access details')
    }
  }),

  updateProjectAccess: expressify(async (req, res) => {
    try {
      const { params, body } = parseReq(req, updateProjectAccessSchema)
      const actingAdminId = SessionManager.getLoggedInUserId(req.session)
      const project = await AdminService.updateProjectAccessPolicy(
        params.projectId,
        actingAdminId,
        body
      )
      res.json({ ok: true, project })
    } catch (err) {
      sendAdminError(res, err, 'Failed to update project access policy')
    }
  }),

  addProjectCollaborator: expressify(async (req, res) => {
    try {
      const { params, body } = parseReq(req, addProjectCollaboratorSchema)
      if (!body.userId && !body.email) {
        return res
          .status(400)
          .json({ message: 'Select a user or enter an email address' })
      }
      const actingAdminId = SessionManager.getLoggedInUserId(req.session)
      const project = await AdminService.addProjectCollaborator(
        params.projectId,
        actingAdminId,
        body
      )
      res.status(201).json({ ok: true, project })
    } catch (err) {
      sendAdminError(res, err, 'Failed to add project collaborator')
    }
  }),

  updateProjectCollaborator: expressify(async (req, res) => {
    try {
      const { params, body } = parseReq(req, updateProjectCollaboratorSchema)
      const actingAdminId = SessionManager.getLoggedInUserId(req.session)
      const project = await AdminService.updateProjectCollaborator(
        params.projectId,
        actingAdminId,
        params.userId,
        body.permissionMode
      )
      res.json({ ok: true, project })
    } catch (err) {
      sendAdminError(res, err, 'Failed to update collaborator permission')
    }
  }),

  removeProjectCollaborator: expressify(async (req, res) => {
    try {
      const { params } = parseReq(req, projectCollaboratorParamsSchema)
      const project = await AdminService.removeProjectCollaborator(
        params.projectId,
        params.userId
      )
      res.json({ ok: true, project })
    } catch (err) {
      sendAdminError(res, err, 'Failed to remove project collaborator')
    }
  }),

  getPublicLogo: expressify(async (req, res) => {
    const variant = req.path?.endsWith('logo-dark') ? 'dark' : 'light'
    const asset = await WorkspaceBrandingService.getLogoAsset(variant)
    if (!asset) {
      return res.status(404).end()
    }
    res.setHeader('Content-Type', asset.mimeType)
    res.setHeader('X-Content-Type-Options', 'nosniff')
    res.setHeader(
      'Content-Security-Policy',
      "default-src 'none'; img-src 'self' data:; style-src 'unsafe-inline'"
    )
    if (req.query?.v && req.query.v === asset.version) {
      res.setHeader('Cache-Control', 'public, max-age=31536000, immutable')
    } else {
      res.setHeader('Cache-Control', 'no-cache')
    }
    return res.send(asset.buffer)
  }),

  getBranding: expressify(async (_req, res) => {
    try {
      const branding = await WorkspaceBrandingService.getBrandingSummary()
      res.json({ ok: true, branding })
    } catch (err) {
      sendAdminError(res, err, 'Failed to load workspace branding settings')
    }
  }),

  updateBranding: expressify(async (req, res) => {
    try {
      const { body } = parseReq(req, updateBrandingSchema)
      const actingAdmin = SessionManager.getSessionUser(req.session)
      const branding = await WorkspaceBrandingService.updateBranding({
        organizationName: body.organizationName,
        logoDataUrl: body.logoDataUrl,
        logoDarkDataUrl: body.logoDarkDataUrl,
        clearLogo: body.clearLogo,
        clearLogoDark: body.clearLogoDark,
        updatedBy: actingAdmin?.email || '',
      })
      res.json({ ok: true, branding })
    } catch (err) {
      sendAdminError(res, err, 'Failed to update organization logo')
    }
  }),

  resetBranding: expressify(async (req, res) => {
    try {
      const actingAdmin = SessionManager.getSessionUser(req.session)
      const branding = await WorkspaceBrandingService.resetBranding(
        actingAdmin?.email || ''
      )
      res.json({ ok: true, branding })
    } catch (err) {
      sendAdminError(res, err, 'Failed to reset organization logo')
    }
  }),

  // Legacy HTML form handlers preserved safely
  disconnectAllUsers: (req, res) => {
    const { query } = parseReq(req, disconnectAllUsersSchema, { logOnly: true })
    AdminService.disconnectAllUsers(query.delay)
    res.redirect('/admin#maintenance')
  },

  openEditor(_req, res) {
    AdminService.setEditorOpen(true)
    res.redirect('/admin#maintenance')
  },

  closeEditor(req, res) {
    const { body } = parseReq(req, closeEditorSchema, { logOnly: true })
    AdminService.setEditorOpen(Boolean(body.isOpen))
    res.redirect('/admin#maintenance')
  },

  flushProjectToTpds(req, res, next) {
    const { body } = parseReq(req, flushProjectToTpdsSchema, { logOnly: true })
    TpdsProjectFlusher.flushProjectToTpds(body.project_id, error => {
      if (error) {
        return next(error)
      }
      res.sendStatus(200)
    })
  },

  pollDropboxForUser(req, res) {
    const { body } = parseReq(req, pollDropboxForUserSchema, { logOnly: true })
    TpdsUpdateSender.pollDropboxForUser(body.user_id, () => res.sendStatus(200))
  },

  createMessage: expressify(async (req, res) => {
    const { body } = parseReq(req, createMessageSchema, { logOnly: true })
    await AdminService.createSystemMessage(body.content)
    res.redirect('/admin#maintenance')
  }),

  clearMessages: expressify(async (_req, res) => {
    await AdminService.clearSystemMessages()
    res.redirect('/admin#maintenance')
  }),
}

export default AdminController

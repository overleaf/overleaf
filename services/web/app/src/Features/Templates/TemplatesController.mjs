import path from 'node:path'
import SessionManager from '../Authentication/SessionManager.mjs'
import TemplatesManager from './TemplatesManager.mjs'
import ProjectHelper from '../Project/ProjectHelper.mjs'
import { expressify } from '@overleaf/promise-utils'
import { parseReq, z } from '../../infrastructure/Validation.mjs'

// numeric v1 ids (template id / template version id)
const numericId = z.string().regex(/^[0-9]+$/)

const getV1TemplateSchema = z.object({
  params: z.strictObject({ Template_version_id: numericId }),
  query: z.object({
    id: numericId,
    templateName: z.string().optional(),
    latexEngine: z.string().optional(),
    texImage: z.string().optional(),
    mainFile: z.string().optional(),
    brandVariationId: z.coerce.number().int().positive().optional(),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const getV1TemplateFallbackSchema = z.object({
  params: z.object({ Template_version_id: numericId }).passthrough(),
  query: z.object({ id: numericId }).passthrough(),
})

const createProjectFromV1TemplateSchema = z.object({
  body: z.strictObject({
    templateId: numericId,
    templateVersionId: numericId,
    brandVariationId: z.coerce.number().int().positive().optional(),
    compiler: z.string().optional(),
    mainFile: z.string().optional(),
    templateName: z.string().optional(),
    imageName: z.string().optional(),
  }),
})

// Rollout-temporary fallback (pre-refinement schema from main); delete
// when this route's REQ_VALIDATION_MODE instrumentation is removed.
const createProjectFromV1TemplateFallbackSchema = z.object({
  body: z
    .object({
      templateId: numericId,
      templateVersionId: numericId,
    })
    .passthrough(),
})

const TemplatesController = {
  async getV1Template(req, res) {
    const {
      params: { Template_version_id: templateVersionId },
      query,
    } = parseReq(req, getV1TemplateSchema, {
      fallbackSchema: getV1TemplateFallbackSchema,
    })
    const data = {
      templateVersionId,
      templateId: query.id,
      name: query.templateName,
      compiler: ProjectHelper.compilerFromV1Engine(query.latexEngine),
      imageName: query.texImage,
      mainFile: query.mainFile,
      brandVariationId: query.brandVariationId,
    }
    res.render(
      path.resolve(
        import.meta.dirname,
        '../../../views/project/editor/new_from_template'
      ),
      data
    )
  },

  async createProjectFromV1Template(req, res) {
    const { body } = parseReq(req, createProjectFromV1TemplateSchema, {
      fallbackSchema: createProjectFromV1TemplateFallbackSchema,
    })
    const userId = SessionManager.getLoggedInUserId(req.session)
    const project = await TemplatesManager.promises.createProjectFromV1Template(
      body.brandVariationId,
      body.compiler,
      body.mainFile,
      body.templateId,
      body.templateName,
      body.templateVersionId,
      userId,
      body.imageName
    )
    delete req.session.templateData
    if (!project) {
      throw new Error('failed to create project from template')
    }
    return res.redirect(`/project/${project._id}`)
  },
}

export default {
  getV1Template: expressify(TemplatesController.getV1Template),
  createProjectFromV1Template: expressify(
    TemplatesController.createProjectFromV1Template
  ),
}

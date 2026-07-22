import path from 'node:path'
import SessionManager from '../Authentication/SessionManager.mjs'
import TemplatesManager from './TemplatesManager.mjs'
import ProjectHelper from '../Project/ProjectHelper.mjs'
import { expressify } from '@overleaf/promise-utils'
import { parseReq, z } from '../../infrastructure/Validation.mjs'

// numeric v1 ids (template id / template version id)
const numericId = z.string().regex(/^[0-9]+$/)

const getV1TemplateSchema = z.object({
  params: z.object({ Template_version_id: numericId }),
  query: z.object({ id: numericId }),
})

const createProjectFromV1TemplateSchema = z.object({
  body: z.object({
    templateId: numericId,
    templateVersionId: numericId,
  }),
})

const TemplatesController = {
  async getV1Template(req, res) {
    const {
      params: { Template_version_id: templateVersionId },
      query: { id: templateId },
    } = parseReq(req, getV1TemplateSchema)
    const data = {
      templateVersionId,
      templateId,
      name: req.query.templateName,
      compiler: ProjectHelper.compilerFromV1Engine(req.query.latexEngine),
      imageName: req.query.texImage,
      mainFile: req.query.mainFile,
      brandVariationId: req.query.brandVariationId,
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
    const {
      body: { templateId, templateVersionId },
    } = parseReq(req, createProjectFromV1TemplateSchema)
    const userId = SessionManager.getLoggedInUserId(req.session)
    const project = await TemplatesManager.promises.createProjectFromV1Template(
      req.body.brandVariationId,
      req.body.compiler,
      req.body.mainFile,
      templateId,
      req.body.templateName,
      templateVersionId,
      userId,
      req.body.imageName
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

import { z, parseReq } from '../../infrastructure/Validation.mjs'

const saveTemplateDataInSessionSchema = z.object({
  query: z.object({
    templateName: z.string().optional(),
  }),
})

export default {
  saveTemplateDataInSession(req, res, next) {
    const { query } = parseReq(req, saveTemplateDataInSessionSchema, {
      logOnly: true,
    })
    if (query.templateName) {
      // only `templateName` is ever read back out of session.templateData
      // (see UserPagesController.registerPage) — store just that field
      req.session.templateData = { templateName: query.templateName }
    }
    return next()
  },
}

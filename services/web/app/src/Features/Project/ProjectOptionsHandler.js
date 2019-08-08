const { Project } = require('../../models/Project')
const logger = require('logger-sharelatex')
const settings = require('settings-sharelatex')

const safeCompilers = ['xelatex', 'pdflatex', 'latex', 'lualatex']

module.exports = {
  setCompiler(projectId, compiler, callback) {
    logger.log({ projectId, compiler }, 'setting the compiler')
    if (!compiler) {
      return callback()
    }
    compiler = compiler.toLowerCase()
    if (!safeCompilers.includes(compiler)) {
      return callback(new Error(`invalid compiler: ${compiler}`))
    }
    const conditions = { _id: projectId }
    const update = { compiler }
    Project.update(conditions, update, {}, callback)
  },

  setImageName(projectId, imageName, callback) {
    logger.log({ projectId, imageName }, 'setting the imageName')
    if (!imageName || !Array.isArray(settings.allowedImageNames)) {
      return callback()
    }
    imageName = imageName.toLowerCase()
    const isAllowed = settings.allowedImageNames.find(
      allowed => imageName === allowed.imageName
    )
    if (!isAllowed) {
      return callback(new Error(`invalid imageName: ${imageName}`))
    }
    const conditions = { _id: projectId }
    const update = { imageName: settings.imageRoot + '/' + imageName }
    Project.update(conditions, update, {}, callback)
  },

  setSpellCheckLanguage(projectId, languageCode, callback) {
    logger.log({ projectId, languageCode }, 'setting the spell check language')
    if (!Array.isArray(settings.languages)) {
      return callback()
    }
    const language = settings.languages.find(
      language => language.code === languageCode
    )
    if (languageCode && !language) {
      return callback(new Error(`invalid languageCode: ${languageCode}`))
    }
    const conditions = { _id: projectId }
    const update = { spellCheckLanguage: languageCode }
    Project.update(conditions, update, {}, callback)
  },

  setBrandVariationId(projectId, brandVariationId, callback) {
    logger.log(
      { projectId, brandVariationId },
      'setting the brand variation id'
    )
    if (!brandVariationId) {
      return callback()
    }
    const conditions = { _id: projectId }
    const update = { brandVariationId }
    Project.update(conditions, update, {}, callback)
  },

  unsetBrandVariationId(projectId, callback) {
    logger.log({ projectId }, 'unsetting the brand variation id')
    const conditions = { _id: projectId }
    const update = { $unset: { brandVariationId: 1 } }
    Project.update(conditions, update, {}, callback)
  }
}

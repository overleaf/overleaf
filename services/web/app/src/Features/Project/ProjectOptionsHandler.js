const { Project } = require('../../models/Project')
const settings = require('settings-sharelatex')
const { promisifyAll } = require('../../util/promises')

const safeCompilers = ['xelatex', 'pdflatex', 'latex', 'lualatex']

const ProjectOptionsHandler = {
  setCompiler(projectId, compiler, callback) {
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
    if (!brandVariationId) {
      return callback()
    }
    const conditions = { _id: projectId }
    const update = { brandVariationId }
    Project.update(conditions, update, {}, callback)
  },

  unsetBrandVariationId(projectId, callback) {
    const conditions = { _id: projectId }
    const update = { $unset: { brandVariationId: 1 } }
    Project.update(conditions, update, {}, callback)
  }
}

ProjectOptionsHandler.promises = promisifyAll(ProjectOptionsHandler)
module.exports = ProjectOptionsHandler

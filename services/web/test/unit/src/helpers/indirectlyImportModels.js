// When importing models in vitest unit tests we need to import them from a CJS file
// instead of directly from the test file so that we can mock the model when it is imported via CJS
// and make sure that is in the require cache for other imports.
//
// TODO: This helper can be removed when all models are converted to ESM and vitest can handle them correctly.

/**
 *
 * @param {string[]} models
 */
module.exports = function (models) {
  return models.reduce((exports, model) => {
    const module = require(`./models/${model}`)
    return {
      ...exports,
      ...module,
    }
  }, {})
}

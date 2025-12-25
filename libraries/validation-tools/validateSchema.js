// @ts-check
const { isZodErrorLike } = require('zod-validation-error')

/**
 * @typedef {import('zod').ZodType} ZodType
 */
/**
 * @template T
 * @typedef {import('zod').output<T>} output<T>
 */

/**
 * A helper function to safely get a nested value from an object
 * using a path array (e.g., ["query", "resource_type"])
 * @param {any} data
 * @param {Array<PropertyKey>} path
 */
function getPathValue(data, path) {
  let current = data
  for (const key of path) {
    if (current === null || typeof current !== 'object') {
      return undefined
    }
    current = current[key]
  }
  return current
}

/**
 * @param {any} issue
 * @param {any} value
 */
const isRequiredError = (issue, value) =>
  value === undefined &&
  (issue.code === 'invalid_type' || issue.code === 'invalid_union')

/**
 * Validates data against a Zod schema and throws a user-friendly error.
 *
 * @template {ZodType} T
 * @param {T} schema - The Zod schema
 * @param {unknown} data - The data to validate
 * @returns {output<T>} The validated (and transformed) data
 */
function validateSchema(schema, data) {
  try {
    return schema.parse(data)
  } catch (err) {
    if (isZodErrorLike(err)) {
      const errorMessages = err.issues.map(issue => {
        const value = getPathValue(data, issue.path)
        const fieldName = String(issue.path[issue.path.length - 1])
        if (isRequiredError(issue, value)) {
          return `"${fieldName}" is required`
        }
        return `"${fieldName}" - ` + issue.message
      })

      throw new Error(errorMessages.join('; '))
    }

    throw err
  }
}

module.exports = { validateSchema }

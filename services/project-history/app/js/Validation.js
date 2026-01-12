import { celebrate, errors } from 'celebrate'

export { Joi } from 'celebrate'

export const errorMiddleware = errors()

/**
 * Validation middleware
 */
export function validate(schema) {
  return celebrate(schema, { allowUnknown: true })
}

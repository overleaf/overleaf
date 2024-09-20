//  @ts-check

const Settings = require('@overleaf/settings')

/**
 * @import { HttpPermissionsPolicy } from './types'
 */

class HttpPermissionsPolicyMiddleware {
  /**
   * Initialise the middleware with a Permissions Policy config
   * @param {HttpPermissionsPolicy} policy
   */
  constructor(policy) {
    this.middleware = this.middleware.bind(this)
    if (policy) {
      this.policy = this.buildPermissionsPolicy(policy)
    }
  }

  /**
   * Checks the provided policy is valid
   * @param {HttpPermissionsPolicy} policy
   * @returns {boolean}
   */
  validatePermissionsPolicy(policy) {
    let policyIsValid = true

    if (!policy.allowed) {
      return true
    }

    for (const [directive, origins] of Object.entries(policy.allowed)) {
      // Do any directives in the allowlist clash with the denylist?
      if (policy.blocked && policy.blocked.includes(directive)) {
        policyIsValid = false
      }
      if (!origins) {
        policyIsValid = false
      }
    }

    return policyIsValid
  }

  /**
   * Constructs a Permissions-Policy header string from the given policy configuration
   * @param {HttpPermissionsPolicy} policy
   * @returns {string}
   */
  buildPermissionsPolicy(policy) {
    if (!this.validatePermissionsPolicy(policy)) {
      throw new Error('Invalid Permissions-Policy header configuration')
    }

    const policyElements = []

    if (policy.blocked && policy.blocked.length > 0) {
      policyElements.push(
        policy.blocked.map(policyElement => `${policyElement}=()`).join(', ')
      )
    }

    if (policy.allowed && Object.entries(policy.allowed).length > 0) {
      policyElements.push(
        Object.keys(policy.allowed)
          .map(allowKey => `${allowKey}=(${policy.allowed[allowKey]})`)
          .join(', ')
      )
    }

    return policyElements.join(', ')
  }

  middleware(req, res, next) {
    if (this.policy && Settings.useHttpPermissionsPolicy) {
      const originalRender = res.render

      res.render = (...args) => {
        res.setHeader('Permissions-Policy', this.policy)
        originalRender.apply(res, args)
      }
    }
    next()
  }
}

module.exports = HttpPermissionsPolicyMiddleware

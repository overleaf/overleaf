/* eslint-disable
    no-control-regex,
    no-throw-literal,
    no-unused-vars,
    no-useless-escape,
    valid-typeof,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
/*
 * decaffeinate suggestions:
 * DS101: Remove unnecessary use of Array.from
 * DS102: Remove unnecessary code created because of implicit returns
 * DS205: Consider reworking code to avoid use of IIFEs
 * DS207: Consider shorter variations of null checks
 * Full docs: https://github.com/decaffeinate/decaffeinate/blob/master/docs/suggestions.md
 */
let RequestParser
const settings = require('@overleaf/settings')

module.exports = RequestParser = {
  VALID_COMPILERS: ['pdflatex', 'latex', 'xelatex', 'lualatex'],
  MAX_TIMEOUT: 600,

  parse(body, callback) {
    let resource
    if (callback == null) {
      callback = function () {}
    }
    const response = {}

    if (body.compile == null) {
      return callback(
        new Error('top level object should have a compile attribute')
      )
    }

    const { compile } = body
    if (!compile.options) {
      compile.options = {}
    }

    try {
      response.metricsOpts = {
        path: this._parseAttribute('metricsPath', compile.options.metricsPath, {
          default: '',
          type: 'string',
        }),
        method: this._parseAttribute(
          'metricsMethod',
          compile.options.metricsMethod,
          {
            default: '',
            type: 'string',
          }
        ),
      }
      response.compiler = this._parseAttribute(
        'compiler',
        compile.options.compiler,
        {
          validValues: this.VALID_COMPILERS,
          default: 'pdflatex',
          type: 'string',
        }
      )
      response.enablePdfCaching = this._parseAttribute(
        'enablePdfCaching',
        compile.options.enablePdfCaching,
        {
          default: false,
          type: 'boolean',
        }
      )
      response.timeout = this._parseAttribute(
        'timeout',
        compile.options.timeout,
        {
          default: RequestParser.MAX_TIMEOUT,
          type: 'number',
        }
      )
      response.imageName = this._parseAttribute(
        'imageName',
        compile.options.imageName,
        {
          type: 'string',
          validValues:
            settings.clsi &&
            settings.clsi.docker &&
            settings.clsi.docker.allowedImages,
        }
      )
      response.draft = this._parseAttribute('draft', compile.options.draft, {
        default: false,
        type: 'boolean',
      })
      response.check = this._parseAttribute('check', compile.options.check, {
        type: 'string',
      })
      response.flags = this._parseAttribute('flags', compile.options.flags, {
        default: [],
        type: 'object',
      })
      if (settings.allowedCompileGroups) {
        response.compileGroup = this._parseAttribute(
          'compileGroup',
          compile.options.compileGroup,
          {
            validValues: settings.allowedCompileGroups,
            default: '',
            type: 'string',
          }
        )
      }
      // The syncType specifies whether the request contains all
      // resources (full) or only those resources to be updated
      // in-place (incremental).
      response.syncType = this._parseAttribute(
        'syncType',
        compile.options.syncType,
        {
          validValues: ['full', 'incremental'],
          type: 'string',
        }
      )

      // The syncState is an identifier passed in with the request
      // which has the property that it changes when any resource is
      // added, deleted, moved or renamed.
      //
      // on syncType full the syncState identifier is passed in and
      // stored
      //
      // on syncType incremental the syncState identifier must match
      // the stored value
      response.syncState = this._parseAttribute(
        'syncState',
        compile.options.syncState,
        { type: 'string' }
      )

      if (response.timeout > RequestParser.MAX_TIMEOUT) {
        response.timeout = RequestParser.MAX_TIMEOUT
      }
      response.timeout = response.timeout * 1000 // milliseconds

      response.resources = (() => {
        const result = []
        for (resource of Array.from(compile.resources || [])) {
          result.push(this._parseResource(resource))
        }
        return result
      })()

      const rootResourcePath = this._parseAttribute(
        'rootResourcePath',
        compile.rootResourcePath,
        {
          default: 'main.tex',
          type: 'string',
        }
      )
      const originalRootResourcePath = rootResourcePath
      const sanitizedRootResourcePath =
        RequestParser._sanitizePath(rootResourcePath)
      response.rootResourcePath = RequestParser._checkPath(
        sanitizedRootResourcePath
      )

      for (resource of Array.from(response.resources)) {
        if (resource.path === originalRootResourcePath) {
          resource.path = sanitizedRootResourcePath
        }
      }
    } catch (error1) {
      const error = error1
      return callback(error)
    }

    return callback(null, response)
  },

  _parseResource(resource) {
    let modified
    if (resource.path == null || typeof resource.path !== 'string') {
      throw 'all resources should have a path attribute'
    }

    if (resource.modified != null) {
      modified = new Date(resource.modified)
      if (isNaN(modified.getTime())) {
        throw `resource modified date could not be understood: ${resource.modified}`
      }
    }

    if (resource.url == null && resource.content == null) {
      throw 'all resources should have either a url or content attribute'
    }
    if (resource.content != null && typeof resource.content !== 'string') {
      throw 'content attribute should be a string'
    }
    if (resource.url != null && typeof resource.url !== 'string') {
      throw 'url attribute should be a string'
    }

    return {
      path: resource.path,
      modified,
      url: resource.url,
      content: resource.content,
    }
  },

  _parseAttribute(name, attribute, options) {
    if (attribute != null) {
      if (options.validValues != null) {
        if (options.validValues.indexOf(attribute) === -1) {
          throw `${name} attribute should be one of: ${options.validValues.join(
            ', '
          )}`
        }
      }
      if (options.type != null) {
        if (typeof attribute !== options.type) {
          throw `${name} attribute should be a ${options.type}`
        }
      }
    } else {
      if (options.default != null) {
        return options.default
      }
    }
    return attribute
  },

  _sanitizePath(path) {
    // See http://php.net/manual/en/function.escapeshellcmd.php
    return path.replace(
      /[\#\&\;\`\|\*\?\~\<\>\^\(\)\[\]\{\}\$\\\x0A\xFF\x00]/g,
      ''
    )
  },

  _checkPath(path) {
    // check that the request does not use a relative path
    for (const dir of Array.from(path.split('/'))) {
      if (dir === '..') {
        throw 'relative path in root resource'
      }
    }
    return path
  },
}

const settings = require('@overleaf/settings')
const OutputCacheManager = require('./OutputCacheManager')

const VALID_COMPILERS = ['pdflatex', 'latex', 'xelatex', 'lualatex']
const MAX_TIMEOUT = 600
const EDITOR_ID_REGEX = /^[a-f0-9-]{36}$/ // UUID

function parse(body, callback) {
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
      path: _parseAttribute('metricsPath', compile.options.metricsPath, {
        default: '',
        type: 'string',
      }),
      method: _parseAttribute('metricsMethod', compile.options.metricsMethod, {
        default: '',
        type: 'string',
      }),
      // Will be populated later. Must always be populated for prom library.
      compile: 'initial',
    }
    response.compiler = _parseAttribute('compiler', compile.options.compiler, {
      validValues: VALID_COMPILERS,
      default: 'pdflatex',
      type: 'string',
    })
    response.compileFromClsiCache = _parseAttribute(
      'compileFromClsiCache',
      compile.options.compileFromClsiCache,
      { default: false, type: 'boolean' }
    )
    response.populateClsiCache = _parseAttribute(
      'populateClsiCache',
      compile.options.populateClsiCache,
      { default: false, type: 'boolean' }
    )
    response.enablePdfCaching = _parseAttribute(
      'enablePdfCaching',
      compile.options.enablePdfCaching,
      {
        default: false,
        type: 'boolean',
      }
    )
    response.pdfCachingMinChunkSize = _parseAttribute(
      'pdfCachingMinChunkSize',
      compile.options.pdfCachingMinChunkSize,
      {
        default: settings.pdfCachingMinChunkSize,
        type: 'number',
      }
    )
    response.timeout = _parseAttribute('timeout', compile.options.timeout, {
      default: MAX_TIMEOUT,
      type: 'number',
    })
    response.imageName = _parseAttribute(
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
    response.draft = _parseAttribute('draft', compile.options.draft, {
      default: false,
      type: 'boolean',
    })
    response.stopOnFirstError = _parseAttribute(
      'stopOnFirstError',
      compile.options.stopOnFirstError,
      {
        default: false,
        type: 'boolean',
      }
    )
    response.check = _parseAttribute('check', compile.options.check, {
      type: 'string',
    })
    response.flags = _parseAttribute('flags', compile.options.flags, {
      default: [],
      type: 'object',
    })
    if (settings.allowedCompileGroups) {
      response.compileGroup = _parseAttribute(
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
    response.syncType = _parseAttribute('syncType', compile.options.syncType, {
      validValues: ['full', 'incremental'],
      type: 'string',
    })

    // The syncState is an identifier passed in with the request
    // which has the property that it changes when any resource is
    // added, deleted, moved or renamed.
    //
    // on syncType full the syncState identifier is passed in and
    // stored
    //
    // on syncType incremental the syncState identifier must match
    // the stored value
    response.syncState = _parseAttribute(
      'syncState',
      compile.options.syncState,
      { type: 'string' }
    )

    if (response.timeout > MAX_TIMEOUT) {
      response.timeout = MAX_TIMEOUT
    }
    response.timeout = response.timeout * 1000 // milliseconds

    response.resources = (compile.resources || []).map(resource =>
      _parseResource(resource)
    )

    const rootResourcePath = _parseAttribute(
      'rootResourcePath',
      compile.rootResourcePath,
      {
        default: 'main.tex',
        type: 'string',
      }
    )
    response.rootResourcePath = _checkPath(rootResourcePath)

    response.editorId = _parseAttribute('editorId', compile.options.editorId, {
      type: 'string',
      regex: EDITOR_ID_REGEX,
    })
    response.buildId = _parseAttribute('buildId', compile.options.buildId, {
      type: 'string',
      regex: OutputCacheManager.BUILD_REGEX,
    })
  } catch (error1) {
    const error = error1
    return callback(error)
  }

  callback(null, response)
}

function _parseResource(resource) {
  let modified
  if (resource.path == null || typeof resource.path !== 'string') {
    throw new Error('all resources should have a path attribute')
  }

  if (resource.modified != null) {
    modified = new Date(resource.modified)
    if (isNaN(modified.getTime())) {
      throw new Error(
        `resource modified date could not be understood: ${resource.modified}`
      )
    }
  }

  if (resource.url == null && resource.content == null) {
    throw new Error(
      'all resources should have either a url or content attribute'
    )
  }
  if (resource.content != null && typeof resource.content !== 'string') {
    throw new Error('content attribute should be a string')
  }
  if (resource.url != null && typeof resource.url !== 'string') {
    throw new Error('url attribute should be a string')
  }
  if (resource.fallbackURL && typeof resource.fallbackURL !== 'string') {
    throw new Error('fallbackURL attribute should be a string')
  }

  return {
    path: resource.path,
    modified,
    url: resource.url,
    fallbackURL: resource.fallbackURL,
    content: resource.content,
  }
}

function _parseAttribute(name, attribute, options) {
  if (attribute != null) {
    if (options.validValues != null) {
      if (options.validValues.indexOf(attribute) === -1) {
        throw new Error(
          `${name} attribute should be one of: ${options.validValues.join(
            ', '
          )}`
        )
      }
    }
    if (options.type != null) {
      // eslint-disable-next-line valid-typeof
      if (typeof attribute !== options.type) {
        throw new Error(`${name} attribute should be a ${options.type}`)
      }
    }
    if (options.type === 'string' && options.regex instanceof RegExp) {
      if (!options.regex.test(attribute)) {
        throw new Error(
          `${name} attribute does not match regex ${options.regex}`
        )
      }
    }
  } else {
    if (options.default != null) {
      return options.default
    }
  }
  return attribute
}

function _checkPath(path) {
  // check that the request does not use a relative path
  for (const dir of Array.from(path.split('/'))) {
    if (dir === '..') {
      throw new Error('relative path in root resource')
    }
  }
  return path
}

module.exports = { parse, MAX_TIMEOUT }

const Path = require('node:path')

const CLSI_REQUEST_SERIALIZED_PROPERTIES = [
  'compiler',
  'compileFromClsiCache',
  'populateClsiCache',
  'enablePdfCaching',
  'pdfCachingMinChunkSize',
  'timeout',
  'imageName',
  'draft',
  'stopOnFirstError',
  'check',
  'flags',
  'compileGroup',
  'syncType',
]

module.exports = {
  /**
   * Serializer for a CLSI request object.
   * Only includes properties useful for logging.
   * Excludes large, sensitive, or irrelevant properties (e.g., 'syncState', 'resources').
   * To add more properties, update the allowed properties above.
   *
   * @param {object} clsiRequest - The original CLSI request object.
   * @returns {object} A summarized version of the request object for logging.
   */
  clsiRequest(clsiRequest) {
    const summary = {}
    for (const key of CLSI_REQUEST_SERIALIZED_PROPERTIES) {
      if (key === 'imageName' && clsiRequest.imageName) {
        summary.imageName = Path.basename(clsiRequest.imageName)
      } else if (clsiRequest[key] !== undefined) {
        summary[key] = clsiRequest[key]
      }
    }
    return summary
  },
}

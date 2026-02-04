/* eslint-disable
    no-unused-vars,
*/
// TODO: This file was created by bulk-decaffeinate.
// Fix any style issues and re-enable lint.
import Path from 'node:path'
let ContentTypeMapper

// here we coerce html, css and js to text/plain,
// otherwise choose correct mime type based on file extension,
// falling back to octet-stream
export default ContentTypeMapper = {
  map(path) {
    switch (Path.extname(path)) {
      case '.txt':
      case '.html':
      case '.js':
      case '.css':
      case '.svg':
        return 'text/plain'
      case '.csv':
        return 'text/csv'
      case '.pdf':
        return 'application/pdf'
      case '.png':
        return 'image/png'
      case '.jpg':
      case '.jpeg':
        return 'image/jpeg'
      case '.tiff':
        return 'image/tiff'
      case '.gif':
        return 'image/gif'
      default:
        return 'application/octet-stream'
    }
  },
}

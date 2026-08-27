import logger from '@overleaf/logger'

logger.debug({}, 'Enable the diagram editor module (full SVG-Edit app, embedded iframe)')

/**
 * Nothing to configure on the server side: the editor hosts the vendored
 * SVG-Edit 7.4.2 app (MIT/permissive OR-license — see
 * `services/web/public/static/svgedit/LICENSE` and the module README) in a
 * same-origin iframe under `/static/svgedit/`. The document source stays
 * with Overleaf (CodeMirror-backed), so no server hooks are required.
 */
const DiagramModule = {}
export default DiagramModule

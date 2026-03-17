/**
 * LAST_ACCESS is "owned" by ProjectPersistenceManager, but needs to be accessed
 * by the DockerRunner. Which in turn is imported through CompileManager from
 * ProjectPersistenceManager. Avoid this cyclic import with an extra module.
 */

// projectId -> timestamp mapping.
export const LAST_ACCESS = new Map()

export function getLastProjectAccessTime(projectId) {
  return LAST_ACCESS.get(projectId) ?? 0
}

import { useCallback } from 'react'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useProjectContext } from '../../../shared/context/project-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { saveProjectSettings } from '../utils/api'

export default function useSetRootDocId() {
  const [rootDocIdScope, setRootDocIdScope] =
    useScopeValue<string>('project.rootDoc_id')
  const { permissionsLevel } = useEditorContext()
  const { _id: projectId } = useProjectContext()

  const setRootDocId = useCallback(
    async (rootDocId: string) => {
      const disallowChange =
        typeof rootDocIdScope === 'undefined' ||
        permissionsLevel === 'readOnly' ||
        rootDocIdScope === rootDocId

      if (!disallowChange) {
        try {
          await saveProjectSettings({ projectId, rootDoc_id: rootDocId })
          setRootDocIdScope(rootDocId)
        } catch (err) {
          // TODO: retry mechanism (max 10x before failed completely and rollback the old value)
        }
      }
    },
    [permissionsLevel, projectId, rootDocIdScope, setRootDocIdScope]
  )
  return setRootDocId
}

import { useCallback } from 'react'
import { useEditorContext } from '../../../shared/context/editor-context'
import { useProjectContext } from '../../../shared/context/project-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { type ProjectSettings, saveProjectSettings } from '../utils/api'

export default function useRootDocId() {
  const [rootDocId, setRootDocId] =
    useScopeValue<ProjectSettings['rootDocId']>('project.rootDoc_id')
  const { permissionsLevel } = useEditorContext()
  const { _id: projectId } = useProjectContext()

  const setRootDocIdFunc = useCallback(
    async (newRootDocId: ProjectSettings['rootDocId']) => {
      const allowUpdate =
        typeof rootDocId !== 'undefined' &&
        permissionsLevel !== 'readOnly' &&
        rootDocId !== newRootDocId

      if (allowUpdate) {
        try {
          await saveProjectSettings({ projectId, rootDocId: newRootDocId })
          setRootDocId(newRootDocId)
        } catch (err) {
          // TODO: retry mechanism (max 10x before failed completely and rollback the old value)
        }
      }
    },
    [permissionsLevel, projectId, rootDocId, setRootDocId]
  )

  return {
    rootDocId,
    setRootDocId: setRootDocIdFunc,
  }
}

import { useCallback } from 'react'
import { useEditorContext } from '../../../shared/context/editor-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import type { ProjectSettings } from '../utils/api'
import useSaveProjectSettings from './use-save-project-settings'

export default function useRootDocId() {
  const [rootDocId] =
    useScopeValue<ProjectSettings['rootDocId']>('project.rootDoc_id')
  const { permissionsLevel } = useEditorContext()
  const saveProjectSettings = useSaveProjectSettings()

  const setRootDocIdFunc = useCallback(
    async (newRootDocId: ProjectSettings['rootDocId']) => {
      // rootDocId will be undefined on angular scope on initialisation
      const allowUpdate =
        typeof rootDocId !== 'undefined' && permissionsLevel !== 'readOnly'

      if (allowUpdate) {
        try {
          await saveProjectSettings('rootDocId', newRootDocId)
        } catch (err) {
          // TODO: retry mechanism (max 10x before failed completely and rollback the old value)
        }
      }
    },
    [permissionsLevel, rootDocId, saveProjectSettings]
  )

  return {
    rootDocId,
    setRootDocId: setRootDocIdFunc,
  }
}

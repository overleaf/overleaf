import { useCallback } from 'react'
import { useProjectContext } from '@/shared/context/project-context'
import type { ProjectSettings } from '../utils/api'
import useSaveProjectSettings from './use-save-project-settings'
import { usePermissionsContext } from '@/features/ide-react/context/permissions-context'

export const useBibliographyDocId = () => {
  const { project } = useProjectContext()
  const mainBibliographyDocId = project?.mainBibliographyDocId
  const saveProjectSettings = useSaveProjectSettings()
  const { write } = usePermissionsContext()

  const setMainBibliographyDocIdFunc = useCallback(
    async (
      newMainBibliographyDocId: ProjectSettings['mainBibliographyDocId']
    ) => {
      if (write) {
        try {
          await saveProjectSettings(
            'mainBibliographyDocId',
            newMainBibliographyDocId
          )
        } catch (err) {
          // TODO: retry mechanism (max 10x before failed completely and rollback the old value)
        }
      }
    },
    [write, saveProjectSettings]
  )

  return {
    mainBibliographyDocId,
    setMainBibliographyDocId: setMainBibliographyDocIdFunc,
  }
}

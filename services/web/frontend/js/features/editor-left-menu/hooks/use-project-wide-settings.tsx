import { useCallback } from 'react'
import type { ProjectSettings } from '../utils/api'
import useRootDocId from './use-root-doc-id'
import useSaveProjectSettings from './use-save-project-settings'
import useSetSpellCheckLanguage from './use-set-spell-check-language'
import { debugConsole } from '@/utils/debugging'
import { useProjectContext } from '@/shared/context/project-context'

export default function useProjectWideSettings() {
  // The value will be undefined on mount
  const { project } = useProjectContext()
  const saveProjectSettings = useSaveProjectSettings()

  const setCompiler = useCallback(
    (newCompiler: ProjectSettings['compiler']) => {
      saveProjectSettings('compiler', newCompiler).catch(debugConsole.error)
    },
    [saveProjectSettings]
  )

  const setImageName = useCallback(
    (newImageName: ProjectSettings['imageName']) => {
      saveProjectSettings('imageName', newImageName).catch(debugConsole.error)
    },
    [saveProjectSettings]
  )

  const { setRootDocId, rootDocId } = useRootDocId()
  const setSpellCheckLanguage = useSetSpellCheckLanguage()

  return {
    compiler: project?.compiler,
    setCompiler,
    imageName: project?.imageName,
    setImageName,
    rootDocId,
    setRootDocId,
    spellCheckLanguage: project?.spellCheckLanguage,
    setSpellCheckLanguage,
  }
}

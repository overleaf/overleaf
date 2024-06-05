import { useCallback } from 'react'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import type { ProjectSettings } from '../utils/api'
import useRootDocId from './use-root-doc-id'
import useSaveProjectSettings from './use-save-project-settings'
import useSetSpellCheckLanguage from './use-set-spell-check-language'
import { debugConsole } from '@/utils/debugging'

export default function useProjectWideSettings() {
  // The value will be undefined on mount
  const [project] = useScopeValue<ProjectSettings | undefined>('project')
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

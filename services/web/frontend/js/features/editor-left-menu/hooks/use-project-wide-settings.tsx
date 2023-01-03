import { useCallback } from 'react'
import { useProjectContext } from '../../../shared/context/project-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { type ProjectSettingsScope, saveProjectSettings } from '../utils/api'
import useRootDocId from './use-root-doc-id'
import useSetSpellCheckLanguage from './use-set-spell-check-language'

export default function useProjectWideSettings() {
  // The value will be undefined on mount
  const [project, setProject] = useScopeValue<ProjectSettingsScope | undefined>(
    'project',
    true
  )
  const { _id: projectId } = useProjectContext()

  const setCompiler = useCallback(
    (compiler: ProjectSettingsScope['compiler']) => {
      const allowUpdate = project?.compiler

      if (allowUpdate) {
        setProject({ ...project, compiler })
        saveProjectSettings({ projectId, compiler })
      }
    },
    [projectId, project, setProject]
  )

  const setImageName = useCallback(
    (imageName: ProjectSettingsScope['imageName']) => {
      const allowUpdate = project?.imageName

      if (allowUpdate) {
        setProject({ ...project, imageName })
        saveProjectSettings({ projectId, imageName })
      }
    },
    [projectId, project, setProject]
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

import { useCallback } from 'react'
import { useProjectContext } from '../../../shared/context/project-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { type ProjectSettingsScope, saveProjectSettings } from '../utils/api'
import useSetRootDocId from './use-set-root-doc-id'
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

  const setRootDocId = useSetRootDocId()
  const setSpellCheckLanguage = useSetSpellCheckLanguage()

  return {
    compiler: project?.compiler,
    setCompiler,
    imageName: project?.imageName,
    setImageName,
    rootDocId: project?.rootDoc_id,
    setRootDocId,
    spellCheckLanguage: project?.spellCheckLanguage,
    setSpellCheckLanguage,
  }
}

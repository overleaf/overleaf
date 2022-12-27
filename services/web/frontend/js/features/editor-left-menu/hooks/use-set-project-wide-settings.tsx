import { useCallback } from 'react'
import { ProjectCompiler } from '../../../../../types/project-settings'
import { useProjectContext } from '../../../shared/context/project-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'
import { ProjectSettingsScope, saveProjectSettings } from '../utils/api'
import useSetRootDocId from './use-set-root-doc-id'

// TODO: handle ignoreUpdates
export default function useSetProjectWideSettings() {
  // The value will be undefined on mount
  const [project, setProject] = useScopeValue<ProjectSettingsScope | undefined>(
    'project',
    true
  )
  const { _id: projectId } = useProjectContext()

  const setCompiler = useCallback(
    (compiler: ProjectCompiler) => {
      if (project?.compiler) {
        setProject({ ...project, compiler })
        saveProjectSettings(projectId, { compiler })
      }
    },
    [projectId, project, setProject]
  )

  const setImageName = useCallback(
    (imageName: string) => {
      if (project?.imageName) {
        setProject({ ...project, imageName })
        saveProjectSettings(projectId, { imageName })
      }
    },
    [projectId, project, setProject]
  )

  const setRootDocId = useSetRootDocId()

  const setSpellCheckLanguage = useCallback(
    (spellCheckLanguage: string) => {
      if (project?.spellCheckLanguage) {
        setProject({ ...project, spellCheckLanguage })
        saveProjectSettings(projectId, { spellCheckLanguage })
      }
    },
    [projectId, project, setProject]
  )

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

import { useCallback } from 'react'
import { ProjectCompiler } from '../../../../../types/project-settings'
import { postJSON } from '../../../infrastructure/fetch-json'
import { useProjectContext } from '../../../shared/context/project-context'
import useScopeValue from '../../../shared/hooks/use-scope-value'

type ProjectScope = {
  compiler: ProjectCompiler
  imageName: string
  rootDoc_id: string
  spellCheckLanguage: string
}

function useSaveProjectSettings() {
  const { _id: projectId } = useProjectContext()

  const saveProject = useCallback(
    (data: Partial<ProjectScope>) => {
      postJSON(`/project/${projectId}/settings`, {
        body: data,
      })
    },
    [projectId]
  )

  return saveProject
}

// TODO: handle ignoreUpdates
export default function useSetProjectWideSettings() {
  // The value will be undefined on mount
  const [project, setProject] = useScopeValue<ProjectScope | undefined>(
    'project',
    true
  )

  const saveProject = useSaveProjectSettings()

  const setCompiler = useCallback(
    (compiler: ProjectCompiler) => {
      if (project?.compiler) {
        setProject({ ...project, compiler })
        saveProject({ compiler })
      }
    },
    [saveProject, project, setProject]
  )

  const setImageName = useCallback(
    (imageName: string) => {
      if (project?.imageName) {
        setProject({ ...project, imageName })
        saveProject({ imageName })
      }
    },
    [saveProject, project, setProject]
  )

  // TODO
  const setRootDocId = useCallback(
    (rootDocId: string) => {
      if (project?.imageName) {
        setProject({ ...project, rootDoc_id: rootDocId })
        // saveProject({ root })
      }
    },
    [project, setProject]
  )

  const setSpellCheckLanguage = useCallback(
    (spellCheckLanguage: string) => {
      if (project?.spellCheckLanguage) {
        setProject({ ...project, spellCheckLanguage })
        saveProject({ spellCheckLanguage })
      }
    },
    [saveProject, project, setProject]
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

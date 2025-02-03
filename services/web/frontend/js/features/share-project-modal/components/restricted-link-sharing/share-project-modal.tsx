import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import ShareProjectModalContent from './share-project-modal-content'
import { useProjectContext } from '@/shared/context/project-context'
import { useSplitTestContext } from '@/shared/context/split-test-context'
import { sendMB } from '@/infrastructure/event-tracking'
import { ProjectContextUpdateValue } from '@/shared/context/types/project-context'
import { useEditorContext } from '@/shared/context/editor-context'
import customLocalStorage from '@/infrastructure/local-storage'

type ShareProjectContextValue = {
  updateProject: (project: ProjectContextUpdateValue) => void
  monitorRequest: <T extends Promise<unknown>>(request: () => T) => T
  inFlight: boolean
  setInFlight: React.Dispatch<
    React.SetStateAction<ShareProjectContextValue['inFlight']>
  >
  error: string | undefined
  setError: React.Dispatch<
    React.SetStateAction<ShareProjectContextValue['error']>
  >
}

const SHOW_MODAL_COOLDOWN_PERIOD = 24 * 60 * 60 * 1000 // 24 hours

const ShareProjectContext = createContext<ShareProjectContextValue | undefined>(
  undefined
)

export function useShareProjectContext() {
  const context = useContext(ShareProjectContext)

  if (!context) {
    throw new Error(
      'useShareProjectContext is only available inside ShareProjectProvider'
    )
  }

  return context
}

type ShareProjectModalProps = {
  handleHide: () => void
  show: boolean
  handleOpen: () => void
  animation?: boolean
}

const ShareProjectModal = React.memo(function ShareProjectModal({
  handleHide,
  show,
  handleOpen,
  animation = true,
}: ShareProjectModalProps) {
  const [inFlight, setInFlight] =
    useState<ShareProjectContextValue['inFlight']>(false)
  const [error, setError] = useState<ShareProjectContextValue['error']>()

  const project = useProjectContext()
  const { isProjectOwner } = useEditorContext()

  const { splitTestVariants } = useSplitTestContext()

  // show the new share modal if project owner
  // is over collaborator limit or has pending editors (once every 24 hours)
  useEffect(() => {
    const hasExceededCollaboratorLimit = () => {
      if (!isProjectOwner || !project.features) {
        return false
      }

      if (project.features.collaborators === -1) {
        return false
      }
      return (
        project.members.filter(member => member.privileges === 'readAndWrite')
          .length > (project.features.collaborators ?? 1) ||
        project.members.some(member => member.pendingEditor)
      )
    }

    if (hasExceededCollaboratorLimit()) {
      const localStorageKey = `last-shown-share-modal.${project._id}`
      const lastShownShareModalTime =
        customLocalStorage.getItem(localStorageKey)
      if (
        !lastShownShareModalTime ||
        lastShownShareModalTime + SHOW_MODAL_COOLDOWN_PERIOD < Date.now()
      ) {
        handleOpen()
        customLocalStorage.setItem(localStorageKey, Date.now())
      }
    }
  }, [project, isProjectOwner, handleOpen])

  // send tracking event when the modal is opened
  useEffect(() => {
    if (show) {
      sendMB('share-modal-opened', {
        splitTestVariant: splitTestVariants['null-test-share-modal'],
        project_id: project._id,
      })
    }
  }, [splitTestVariants, project._id, show])

  // reset error when the modal is opened
  useEffect(() => {
    if (show) {
      setError(undefined)
    }
  }, [show])

  // close the modal if not in flight
  const cancel = useCallback(() => {
    if (!inFlight) {
      handleHide()
    }
  }, [handleHide, inFlight])

  // update `error` and `inFlight` while sending a request
  const monitorRequest = useCallback(request => {
    setError(undefined)
    setInFlight(true)

    const promise = request()

    promise.catch((error: { data?: Record<string, string> }) => {
      setError(
        error.data?.errorReason ||
          error.data?.error ||
          'generic_something_went_wrong'
      )
    })

    promise.finally(() => {
      setInFlight(false)
    })

    return promise
  }, [])

  // merge the new data with the old project data
  const updateProject = useCallback(
    data => Object.assign(project, data),
    [project]
  )

  if (!project) {
    return null
  }

  return (
    <ShareProjectContext.Provider
      value={{
        updateProject,
        monitorRequest,
        inFlight,
        setInFlight,
        error,
        setError,
      }}
    >
      <ShareProjectModalContent
        animation={animation}
        cancel={cancel}
        error={error}
        inFlight={inFlight}
        show={show}
      />
    </ShareProjectContext.Provider>
  )
})

export default ShareProjectModal

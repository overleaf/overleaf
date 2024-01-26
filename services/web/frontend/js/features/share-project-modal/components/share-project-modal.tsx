import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react'
import ShareProjectModalContent from './share-project-modal-content'
import { useProjectContext } from '../../../shared/context/project-context'
import { useSplitTestContext } from '../../../shared/context/split-test-context'
import { sendMB } from '../../../infrastructure/event-tracking'
import { Project } from '../../../../../types/project'

type ShareProjectContextValue = {
  updateProject: (project: Project) => void
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
  animation?: boolean
}

const ShareProjectModal = React.memo(function ShareProjectModal({
  handleHide,
  show,
  animation = true,
}: ShareProjectModalProps) {
  const [inFlight, setInFlight] =
    useState<ShareProjectContextValue['inFlight']>(false)
  const [error, setError] = useState<ShareProjectContextValue['error']>()

  const project = useProjectContext()

  const { splitTestVariants } = useSplitTestContext()

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

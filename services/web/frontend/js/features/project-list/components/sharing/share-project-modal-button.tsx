import { memo, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ShareProjectModal from '@/features/share-project-modal/components/share-project-modal'
import { getJSON, getUserFacingMessage } from '@/infrastructure/fetch-json'
import MaterialIcon from '@/shared/components/material-icon'
import Notification from '@/shared/components/notification'
import OLButton from '@/shared/components/ol/ol-button'
import OLIconButton from '@/shared/components/ol/ol-icon-button'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import OLTooltip from '@/shared/components/ol/ol-tooltip'
import { EditorContext } from '@/shared/context/editor-context'
import { ProjectContext } from '@/shared/context/project-context'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import {
  ProjectMetadata,
  ProjectUpdate,
} from '@/shared/context/types/project-metadata'
import { UserContext } from '@/shared/context/user-context'
import useIsMounted from '@/shared/hooks/use-is-mounted'
import getMeta from '@/utils/meta'
import { Project } from '../../../../../../types/project/dashboard/api'
import { User } from '../../../../../../types/user'
import { useProjectListContext } from '../../context/project-list-context'

type DashboardSharingBootstrapResponse = {
  isProjectOwner: boolean
  canAdminProject: boolean
  isRestrictedTokenMember: boolean
  projectMetadata: ProjectMetadata
}

type ShareButtonProps = {
  project: Project
  children: (text: string, handleOpenModal: () => void) => React.ReactElement
}

function DashboardShareProjectModal({
  project,
  show,
  onHide,
}: {
  project: Project
  show: boolean
  onHide: () => void
}) {
  const { t } = useTranslation()
  const { refreshProjectsList } = useProjectListContext()
  const themedModals = useFeatureFlag('themed-modals')
  const isMounted = useIsMounted()

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [projectMetadata, setProjectMetadata] =
    useState<ProjectMetadata | null>(null)
  const [isProjectOwner, setIsProjectOwner] = useState(
    project.accessLevel === 'owner'
  )
  const [canAdminProject, setCanAdminProject] = useState(false)
  const [isRestrictedTokenMember, setIsRestrictedTokenMember] = useState(false)
  const mutatedRef = useRef(false)

  const currentUser = useMemo<User>(() => {
    const rawUser = (getMeta('ol-user') || {}) as Record<string, any>
    const metaUserId = getMeta('ol-user_id')
    return {
      ...rawUser,
      id: String(rawUser.id || rawUser._id || metaUserId || ''),
      email: rawUser.email || '',
      first_name: rawUser.first_name || '',
      last_name: rawUser.last_name || '',
      isAdmin: Boolean(rawUser.isAdmin),
      features: rawUser.features || {},
    } as User
  }, [])

  useEffect(() => {
    if (!show) {
      return
    }
    mutatedRef.current = false
    setLoading(true)
    setError(null)

    getJSON<DashboardSharingBootstrapResponse>(
      `/api/projects/${encodeURIComponent(project.id)}/sharing`
    )
      .then(res => {
        if (!isMounted.current) return
        setProjectMetadata(res.projectMetadata)
        setIsProjectOwner(Boolean(res.isProjectOwner))
        setCanAdminProject(Boolean(res.canAdminProject))
        setIsRestrictedTokenMember(Boolean(res.isRestrictedTokenMember))
      })
      .catch(err => {
        if (!isMounted.current) return
        setError(String(getUserFacingMessage(err as Error) || 'Failed to load sharing settings'))
      })
      .finally(() => {
        if (isMounted.current) {
          setLoading(false)
        }
      })
  }, [isMounted, project.id, show])

  const handleClose = useCallback(() => {
    onHide()
    if (mutatedRef.current) {
      mutatedRef.current = false
      refreshProjectsList()
    }
  }, [onHide, refreshProjectsList])

  const updateProject = useCallback((projectUpdateData: ProjectUpdate) => {
    mutatedRef.current = true
    setProjectMetadata(prev =>
      prev ? Object.assign({}, prev, projectUpdateData) : prev
    )
  }, [])

  const joinProject = useCallback((data: ProjectMetadata) => {
    setProjectMetadata(data)
  }, [])

  const projectContextValue = useMemo(
    () => ({
      projectId: projectMetadata?._id || project.id,
      project: projectMetadata,
      joinProject,
      updateProject,
      joinedOnce: Boolean(projectMetadata),
      projectSnapshot: undefined as any,
      tags: [],
      features: projectMetadata?.features || {},
      name: projectMetadata?.name || project.name,
    }),
    [joinProject, project.id, project.name, projectMetadata, updateProject]
  )

  const editorContextValue = useMemo(
    () => ({
      cobranding: undefined,
      hasPremiumCompile: projectMetadata?.features?.compileGroup === 'priority',
      renameProject: () => {},
      insertSymbol: undefined,
      isProjectOwner,
      canAdminProject: canAdminProject || Boolean(currentUser.isAdmin),
      isRestrictedTokenMember,
      isPendingEditor: false,
      hasSuggestionsLeft: false,
      suggestionsLeft: 0,
      setSuggestionsLeft: () => {},
      premiumSuggestionResetDate: new Date(),
      setPremiumSuggestionResetDate: () => {},
      hasTokensLeft: false,
      tokensLeft: 0,
      setTokensLeft: () => {},
      tokenResetDate: new Date(),
      setTokenResetDate: () => {},
      writefullInstance: null,
      setWritefullInstance: () => {},
      upgradeTrackChangesModal: { show: false },
      setUpgradeTrackChangesModal: () => {},
    }),
    [
      canAdminProject,
      currentUser.isAdmin,
      isProjectOwner,
      isRestrictedTokenMember,
      projectMetadata?.features?.compileGroup,
    ]
  )

  if (!show) {
    return null
  }

  if (loading || error || !projectMetadata) {
    return (
      <OLModal
        show={show}
        onHide={handleClose}
        animation
        themed={themedModals}
      >
        <OLModalHeader closeButton>
          <OLModalTitle>{t('share_project')}</OLModalTitle>
        </OLModalHeader>
        <OLModalBody className="modal-body-share modal-link-share">
          {loading ? (
            <div className="d-flex align-items-center gap-2 py-3">
              <OLSpinner size="sm" />
              <span>{t('loading')}…</span>
            </div>
          ) : (
            <div className="notification-list">
              <Notification
                type="error"
                content={error || t('generic_something_went_wrong')}
                className="mb-0"
              />
            </div>
          )}
        </OLModalBody>
        <OLModalFooter>
          <OLButton variant="secondary" type="button" onClick={handleClose}>
            {t('close')}
          </OLButton>
        </OLModalFooter>
      </OLModal>
    )
  }

  return (
    <UserContext.Provider value={currentUser}>
      <ProjectContext.Provider value={projectContextValue}>
        <EditorContext.Provider value={editorContextValue}>
          <ShareProjectModal
            show={show}
            handleOpen={() => {}}
            handleHide={handleClose}
          />
        </EditorContext.Provider>
      </ProjectContext.Provider>
    </UserContext.Provider>
  )
}

function ShareProjectButton({ project, children }: ShareButtonProps) {
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)
  const isMounted = useIsMounted()
  const isSiteAdmin = Boolean(getMeta('ol-user')?.isAdmin)

  const handleOpenModal = useCallback(() => {
    setShowModal(true)
  }, [])

  const handleCloseModal = useCallback(() => {
    if (isMounted.current) {
      setShowModal(false)
    }
  }, [isMounted])

  if (
    project.archived ||
    project.trashed ||
    (project.accessLevel !== 'owner' && !isSiteAdmin)
  ) {
    return null
  }

  return (
    <>
      {children(t('share'), handleOpenModal)}
      <DashboardShareProjectModal
        project={project}
        show={showModal}
        onHide={handleCloseModal}
      />
    </>
  )
}

const ShareProjectButtonTooltip = memo(function ShareProjectButtonTooltip({
  project,
}: Pick<ShareButtonProps, 'project'>) {
  return (
    <ShareProjectButton project={project}>
      {(text, handleOpenModal) => (
        <OLTooltip
          key={`tooltip-share-project-${project.id}`}
          id={`share-project-${project.id}`}
          description={text}
          overlayProps={{ placement: 'top', trigger: ['hover', 'focus'] }}
        >
          <span>
            <OLIconButton
              onClick={handleOpenModal}
              variant="link"
              accessibilityLabel={text}
              className="action-btn"
              icon="person_add"
            />
          </span>
        </OLTooltip>
      )}
    </ShareProjectButton>
  )
})

export default memo(ShareProjectButton)
export { ShareProjectButtonTooltip }

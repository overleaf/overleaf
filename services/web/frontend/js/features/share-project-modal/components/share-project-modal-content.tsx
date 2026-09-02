import { useTranslation } from 'react-i18next'
import { useEditorContext } from '@/shared/context/editor-context'
import { lazy, Suspense, useState } from 'react'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import ClickableElementEnhancer from '@/shared/components/clickable-element-enhancer'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import Notification from '@/shared/components/notification'
import OLButton from '@/shared/components/ol/ol-button'
import OLSpinner from '@/shared/components/ol/ol-spinner'
import MaterialIcon from '@/shared/components/material-icon'
import CopySharingLinkButton from '@/features/share-project-modal/components/copy-sharing-link-button'
import ErrorMessage from '@/features/share-project-modal/components/error-message'
import GiveFeedbackLink from '@/features/share-project-modal/components/give-feedback-link'
import classNames from 'classnames'
import { useFeatureFlag } from '@/shared/context/split-test-context'
import { useShareProjectContext } from '@/features/share-project-modal/components/share-project-modal'
import { ErrorBoundaryFallback } from '@/shared/components/error-boundary-fallback'
import withErrorBoundary from '@/infrastructure/error-boundary'

const ReadOnlyTokenLink = lazy(() =>
  import('./link-sharing').then(({ ReadOnlyTokenLink }) => ({
    // re-export as default -- lazy can only handle default exports.
    default: ReadOnlyTokenLink,
  }))
)

const ShareModalBody = lazy(() => import('./share-modal-body'))

export type ShareModalScreen =
  | 'project-access'
  | 'invited-people'
  | 'access-requests'

type ShareProjectModalContentProps = {
  cancel: () => void
  onShow: () => void
  show: boolean
  animation: boolean
  inFlight: boolean
  error: string | undefined
  projectName?: string
}

export default function ShareProjectModalContent({
  show,
  onShow,
  cancel,
  animation,
  inFlight,
  error,
  projectName,
}: ShareProjectModalContentProps) {
  return (
    <OLModal show={show} onShow={onShow} onHide={cancel} animation={animation}>
      <ShareProjectModalContentInnerWithErrorBoundary
        inFlight={inFlight}
        error={error}
        projectName={projectName}
        cancel={cancel}
      />
    </OLModal>
  )
}

function ShareProjectModalContentInner({
  inFlight,
  error,
  projectName,
  cancel,
}: Pick<
  ShareProjectModalContentProps,
  'inFlight' | 'error' | 'projectName' | 'cancel'
>) {
  const { t } = useTranslation()
  const isSharingUpdatesEnabled = useFeatureFlag('sharing-updates')
  // The copy-sharing-link button only applies to the new reusable links; legacy
  // token links are copied from their own inputs, so hide it when the new-link
  // feature is off.
  const isNewLinkEnabled = useFeatureFlag('sharing-updates-new-link')
  const { successActionMessage, projectAccess } = useShareProjectContext()
  const [screen, setScreen] = useState<ShareModalScreen>('project-access')
  const { isRestrictedTokenMember, isProjectOwner } = useEditorContext()
  const isSubScreen = screen !== 'project-access'

  return (
    <>
      <OLModalHeader>
        <div className="d-flex flex-grow-1 justify-content-between">
          {isSharingUpdatesEnabled && isSubScreen ? (
            <OLButton
              variant="ghost"
              onClick={() => setScreen('project-access')}
              leadingIcon="arrow_back_ios_new"
            >
              {t('back')}
            </OLButton>
          ) : (
            <OLModalTitle>
              {isSharingUpdatesEnabled && projectName
                ? t('share_project_name', { projectName })
                : t('share_project')}
            </OLModalTitle>
          )}
          {isSharingUpdatesEnabled && isProjectOwner && <GiveFeedbackLink />}
        </div>
      </OLModalHeader>
      <OLModalBody
        className={classNames('modal-body-share modal-link-share', {
          'modal-redesign': isSharingUpdatesEnabled,
        })}
      >
        <div
          className={classNames({
            'container-fluid': !isSharingUpdatesEnabled,
          })}
        >
          <Suspense fallback={<FullSizeLoadingSpinner minHeight="15rem" />}>
            {isRestrictedTokenMember ? (
              <ReadOnlyTokenLink />
            ) : (
              <ShareModalBody
                screen={screen}
                setScreen={setScreen}
                error={error}
              />
            )}
          </Suspense>
          {!isSharingUpdatesEnabled && error && (
            <div className="notification-list">
              <Notification
                type="error"
                content={<ErrorMessage error={error} />}
                className="mb-0 mt-3"
              />
            </div>
          )}
        </div>
      </OLModalBody>
      <OLModalFooter>
        <div className="d-flex flex-grow-1 flex-wrap gap-2">
          {isSharingUpdatesEnabled ? (
            <>
              {isNewLinkEnabled &&
                !isSubScreen &&
                projectAccess &&
                (projectAccess === 'onlyInvitedPeople' ||
                  projectAccess.startsWith('anyoneInXyzWithTheLink') ||
                  projectAccess === 'anyoneWithTheLink') && (
                  <CopySharingLinkButton />
                )}
              {successActionMessage && (
                <div className="ms-auto px-3 align-self-center">
                  <div
                    className="d-flex gap-2 align-items-center"
                    role="status"
                    aria-live="polite"
                  >
                    <MaterialIcon
                      unfilled
                      type="check_circle"
                      className="text-success"
                    />
                    <span>{successActionMessage}</span>
                  </div>
                </div>
              )}
            </>
          ) : (
            inFlight && <OLSpinner size="sm" />
          )}
        </div>

        <ClickableElementEnhancer
          onClick={cancel}
          as={OLButton}
          variant={isSharingUpdatesEnabled ? 'ghost' : 'secondary'}
          isLoading={isSharingUpdatesEnabled && inFlight}
          disabled={inFlight}
        >
          {t('close')}
        </ClickableElementEnhancer>
      </OLModalFooter>
    </>
  )
}

const ShareProjectModalContentInnerFallback = () => {
  const { t } = useTranslation()
  return (
    <>
      <OLModalHeader>
        <OLModalTitle>{t('generic_something_went_wrong')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <ErrorBoundaryFallback />
      </OLModalBody>
    </>
  )
}

const ShareProjectModalContentInnerWithErrorBoundary = withErrorBoundary(
  ShareProjectModalContentInner,
  () => <ShareProjectModalContentInnerFallback />
)

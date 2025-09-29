import { useTranslation } from 'react-i18next'
import { useEditorContext } from '@/shared/context/editor-context'
import { lazy, Suspense } from 'react'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import ClickableElementEnhancer from '@/shared/components/clickable-element-enhancer'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLNotification from '@/shared/components/ol/ol-notification'
import OLButton from '@/shared/components/ol/ol-button'
import OLSpinner from '@/shared/components/ol/ol-spinner'

const ReadOnlyTokenLink = lazy(() =>
  import('./link-sharing').then(({ ReadOnlyTokenLink }) => ({
    // re-export as default -- lazy can only handle default exports.
    default: ReadOnlyTokenLink,
  }))
)

const ShareModalBody = lazy(() => import('./share-modal-body'))

type ShareProjectModalContentProps = {
  cancel: () => void
  show: boolean
  animation: boolean
  inFlight: boolean
  error: string | undefined
}

export default function ShareProjectModalContent({
  show,
  cancel,
  animation,
  inFlight,
  error,
}: ShareProjectModalContentProps) {
  const { t } = useTranslation()

  const { isRestrictedTokenMember } = useEditorContext()

  return (
    <OLModal show={show} onHide={cancel} animation={animation}>
      <OLModalHeader>
        <OLModalTitle>{t('share_project')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody className="modal-body-share modal-link-share">
        <div className="container-fluid">
          <Suspense fallback={<FullSizeLoadingSpinner minHeight="15rem" />}>
            {isRestrictedTokenMember ? (
              <ReadOnlyTokenLink />
            ) : (
              <ShareModalBody />
            )}
          </Suspense>
          {error && (
            <OLNotification
              type="error"
              content={<ErrorMessage error={error} />}
              className="mb-0 mt-3"
            />
          )}
        </div>
      </OLModalBody>

      <OLModalFooter>
        <div className="me-auto">{inFlight && <OLSpinner size="sm" />}</div>

        <ClickableElementEnhancer
          onClick={cancel}
          as={OLButton}
          variant="secondary"
          disabled={inFlight}
        >
          {t('close')}
        </ClickableElementEnhancer>
      </OLModalFooter>
    </OLModal>
  )
}

function ErrorMessage({ error }: Pick<ShareProjectModalContentProps, 'error'>) {
  const { t } = useTranslation()
  switch (error) {
    case 'cannot_invite_non_user':
      return <>{t('cannot_invite_non_user')}</>

    case 'cannot_verify_user_not_robot':
      return <>{t('cannot_verify_user_not_robot')}</>

    case 'cannot_invite_self':
      return <>{t('cannot_invite_self')}</>

    case 'invalid_email':
      return <>{t('invalid_email')}</>

    case 'too_many_requests':
      return <>{t('too_many_requests')}</>

    case 'invite_expired':
      return <>{t('invite_expired')}</>

    case 'invite_resend_limit_hit':
      return <>{t('invite_resend_limit_hit')}</>

    default:
      return <>{t('generic_something_went_wrong')}</>
  }
}

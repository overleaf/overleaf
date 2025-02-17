import { useTranslation } from 'react-i18next'
import Icon from '@/shared/components/icon'
import { useEditorContext } from '@/shared/context/editor-context'
import { lazy, Suspense } from 'react'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import ClickableElementEnhancer from '@/shared/components/clickable-element-enhancer'
import OLModal, {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'
import OLNotification from '@/features/ui/components/ol/ol-notification'
import OLButton from '@/features/ui/components/ol/ol-button'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'
import { bsVersion } from '@/features/utils/bootstrap-5'
import { Spinner } from 'react-bootstrap-5'

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
      <OLModalHeader closeButton>
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
        <div className={bsVersion({ bs3: 'pull-left', bs5: 'me-auto' })}>
          {inFlight && (
            <BootstrapVersionSwitcher
              bs3={<Icon type="refresh" spin />}
              bs5={
                <Spinner
                  animation="border"
                  aria-hidden="true"
                  size="sm"
                  role="status"
                />
              }
            />
          )}
        </div>

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

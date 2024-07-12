import { Button, Modal, Grid } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import Icon from '../../../shared/components/icon'
import AccessibleModal from '../../../shared/components/accessible-modal'
import { useEditorContext } from '../../../shared/context/editor-context'
import { lazy, Suspense } from 'react'
import { FullSizeLoadingSpinner } from '@/shared/components/loading-spinner'
import ClickableElementEnhancer from '@/shared/components/clickable-element-enhancer'

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
    <AccessibleModal show={show} onHide={cancel} animation={animation}>
      <Modal.Header closeButton>
        <Modal.Title>{t('share_project')}</Modal.Title>
      </Modal.Header>

      <Modal.Body className="modal-body-share">
        <Grid fluid>
          <Suspense fallback={<FullSizeLoadingSpinner minHeight="15rem" />}>
            {isRestrictedTokenMember ? (
              <ReadOnlyTokenLink />
            ) : (
              <ShareModalBody />
            )}
          </Suspense>
        </Grid>
      </Modal.Body>

      <Modal.Footer className="modal-footer-share">
        <div className="modal-footer-left">
          {inFlight && <Icon type="refresh" spin />}
          {error && (
            <span className="text-danger error">
              <ErrorMessage error={error} />
            </span>
          )}
        </div>

        <div className="modal-footer-right">
          <ClickableElementEnhancer
            onClick={cancel}
            as={Button}
            type="button"
            bsStyle={null}
            className="btn-secondary"
            disabled={inFlight}
          >
            {t('close')}
          </ClickableElementEnhancer>
        </div>
      </Modal.Footer>
    </AccessibleModal>
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

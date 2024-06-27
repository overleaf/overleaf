import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { linkSharingEnforcementDate } from '../../utils/link-sharing'

type EditorOverLimitModalContentProps = {
  handleHide: () => void
}

export default function EditorOverLimitModalContent({
  handleHide,
}: EditorOverLimitModalContentProps) {
  const { t } = useTranslation()

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>{t('do_you_need_edit_access')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p>
          {t('this_project_has_more_than_max_collabs', {
            linkSharingDate: linkSharingEnforcementDate,
          })}
        </p>
        <p>{t('to_keep_edit_access')}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button
          bsStyle={null}
          className="btn-secondary"
          href="/blog/changes-to-project-sharing"
          target="_blank"
          rel="noreferrer"
        >
          {t('learn_more')}
        </Button>
        <Button className="btn-primary" onClick={handleHide}>
          {t('ok')}
        </Button>
      </Modal.Footer>
    </>
  )
}

import { Button, Modal } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import { sendMB } from '@/infrastructure/event-tracking'

type ViewOnlyAccessModalContentProps = {
  handleHide: () => void
}

export default function ViewOnlyAccessModalContent({
  handleHide,
}: ViewOnlyAccessModalContentProps) {
  const { t } = useTranslation()

  return (
    <>
      <Modal.Header closeButton>
        <Modal.Title>{t('view_only_access')}</Modal.Title>
      </Modal.Header>

      <Modal.Body>
        <p>{t('this_project_already_has_maximum_editors')}</p>
        <p>{t('please_ask_the_project_owner_to_upgrade_more_editors')}</p>
      </Modal.Body>
      <Modal.Footer>
        <Button
          bsStyle={null}
          className="btn-secondary"
          href="/blog/changes-to-project-sharing"
          target="_blank"
          rel="noreferrer"
          onClick={() => {
            sendMB('notification-click', {
              name: 'link-sharing-collaborator-limit',
              button: 'learn',
            })
          }}
        >
          {t('learn_more')}
        </Button>
        <Button
          className="btn-primary"
          onClick={() => {
            sendMB('notification-click', {
              name: 'link-sharing-collaborator-limit',
              button: 'ok',
            })
            handleHide()
          }}
        >
          {t('ok')}
        </Button>
      </Modal.Footer>
    </>
  )
}

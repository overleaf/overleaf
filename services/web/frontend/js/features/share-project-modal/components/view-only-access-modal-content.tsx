import { useTranslation } from 'react-i18next'
import { sendMB } from '@/infrastructure/event-tracking'
import OLButton from '@/shared/components/ol/ol-button'
import {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'

type ViewOnlyAccessModalContentProps = {
  handleHide: () => void
}

export default function ViewOnlyAccessModalContent({
  handleHide,
}: ViewOnlyAccessModalContentProps) {
  const { t } = useTranslation()

  return (
    <>
      <OLModalHeader>
        <OLModalTitle>{t('view_only_access')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <p>{t('this_project_already_has_maximum_collaborators')}</p>
        <p>{t('please_ask_the_project_owner_to_upgrade_more_collaborators')}</p>
      </OLModalBody>
      <OLModalFooter>
        <OLButton
          variant="secondary"
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
        </OLButton>
        <OLButton
          variant="primary"
          onClick={() => {
            sendMB('notification-click', {
              name: 'link-sharing-collaborator-limit',
              button: 'ok',
            })
            handleHide()
          }}
        >
          {t('ok')}
        </OLButton>
      </OLModalFooter>
    </>
  )
}

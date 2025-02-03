import { useTranslation } from 'react-i18next'
import { linkSharingEnforcementDate } from '../utils/link-sharing'
import { sendMB } from '@/infrastructure/event-tracking'
import OLButton from '@/features/ui/components/ol/ol-button'
import {
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/features/ui/components/ol/ol-modal'

type EditorOverLimitModalContentProps = {
  handleHide: () => void
}

export default function EditorOverLimitModalContent({
  handleHide,
}: EditorOverLimitModalContentProps) {
  const { t } = useTranslation()

  return (
    <>
      <OLModalHeader closeButton>
        <OLModalTitle>{t('do_you_need_edit_access')}</OLModalTitle>
      </OLModalHeader>

      <OLModalBody>
        <p>
          {t('this_project_has_more_than_max_collabs', {
            linkSharingDate: linkSharingEnforcementDate,
          })}
        </p>
        <p>{t('to_keep_edit_access')}</p>
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

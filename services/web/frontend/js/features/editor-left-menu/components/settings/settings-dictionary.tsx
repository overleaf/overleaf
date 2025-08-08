import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import DictionaryModal from '../../../dictionary/components/dictionary-modal'
import OLButton from '@/shared/components/ol/ol-button'
import OLFormGroup from '@/shared/components/ol/ol-form-group'
import OLFormLabel from '@/shared/components/ol/ol-form-label'

export default function SettingsDictionary() {
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)

  return (
    <OLFormGroup className="left-menu-setting">
      <OLFormLabel htmlFor="dictionary-settings">{t('dictionary')}</OLFormLabel>
      <OLButton
        id="dictionary-settings"
        variant="secondary"
        size="sm"
        onClick={() => setShowModal(true)}
      >
        {t('edit')}
      </OLButton>

      <DictionaryModal
        show={showModal}
        handleHide={() => setShowModal(false)}
      />
    </OLFormGroup>
  )
}

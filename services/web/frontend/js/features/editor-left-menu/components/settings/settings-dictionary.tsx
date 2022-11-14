import { useState } from 'react'
import { Button } from 'react-bootstrap'
import { useTranslation } from 'react-i18next'
import getMeta from '../../../../utils/meta'
import DictionaryModal from '../../../dictionary/components/dictionary-modal'

export default function SettingsDictionary() {
  const { t } = useTranslation()
  const [showModal, setShowModal] = useState(false)
  const dictionaryEditorEnabled = getMeta(
    'ol-dictionaryEditorEnabled'
  ) as boolean

  if (!dictionaryEditorEnabled) {
    return null
  }

  return (
    <div className="form-group left-menu-setting">
      <label htmlFor="dictionary">{t('dictionary')}</label>
      <Button bsSize="xs" bsStyle="default" onClick={() => setShowModal(true)}>
        {t('edit')}
      </Button>

      <DictionaryModal
        show={showModal}
        handleHide={() => setShowModal(false)}
      />
    </div>
  )
}

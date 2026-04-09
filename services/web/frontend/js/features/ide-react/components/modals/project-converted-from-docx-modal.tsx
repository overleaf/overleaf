import { Trans, useTranslation } from 'react-i18next'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import { useEffect, useState } from 'react'
import { showImportDocxFeedbackToast } from '@/features/project-list/components/new-project-button/import-docx-feedback-toast'

function ProjectConvertedFromDocxModal() {
  const [
    showProjectConvertedFromDocxModal,
    setShowProjectConvertedFromDocxModal,
  ] = useState(false)

  useEffect(() => {
    const query = window.location.search
    const queryString = new URLSearchParams(query)

    if (queryString.get('converted-from-docx') === 'true') {
      setShowProjectConvertedFromDocxModal(true)

      // Clean the URL immediately so a refresh doesn't trigger the modal again,
      // but preserve other search params and the hash.
      const url = new URL(window.location.href)
      url.searchParams.delete('converted-from-docx')
      window.history.replaceState(window.history.state, '', url.toString())
    }
  }, [])

  return (
    <>
      {showProjectConvertedFromDocxModal && (
        <ProjectConvertedFromDocxModalContent
          onHide={() => {
            setShowProjectConvertedFromDocxModal(false)
            showImportDocxFeedbackToast()
          }}
        />
      )}
    </>
  )
}

function ProjectConvertedFromDocxModalContent({
  onHide,
}: {
  onHide: () => void
}) {
  const { t } = useTranslation()

  return (
    <OLModal
      show
      animation
      onHide={onHide}
      id="converted-from-docx-modal"
      backdrop="static"
    >
      <OLModalHeader>
        <OLModalTitle as="h3">
          {t('document_successfully_imported')}
        </OLModalTitle>
      </OLModalHeader>
      <OLModalBody>
        <ul className="docx-modal-list">
          <li>{t('the_document_has_been_converted_to')}</li>
          <li>
            <Trans
              i18nKey="citations_and_cross_references_may_be_written_as_plain_text"
              components={{ code: <code /> }}
            />
          </li>
        </ul>
      </OLModalBody>
      <OLModalFooter>
        <OLButton variant="primary" onClick={onHide}>
          {t('start_editing')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default ProjectConvertedFromDocxModal

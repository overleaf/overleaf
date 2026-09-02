import { useTranslation } from 'react-i18next'
import {
  OLModal,
  OLModalBody,
  OLModalFooter,
  OLModalHeader,
  OLModalTitle,
} from '@/shared/components/ol/ol-modal'
import OLButton from '@/shared/components/ol/ol-button'
import { useEffect, useState } from 'react'
import { useFeatureFlag } from '@/shared/context/split-test-context'

function ProjectConvertedFromDocumentModal() {
  const [convertedFrom, setConvertedFrom] = useState<string | null>(null)

  useEffect(() => {
    const queryString = new URLSearchParams(window.location.search)
    const from = queryString.get('converted-from')

    if (from) {
      setConvertedFrom(from)

      // Clean the URL immediately so a refresh doesn't trigger the modal again,
      // but preserve other search params and the hash.
      const url = new URL(window.location.href)
      url.searchParams.delete('converted-from')
      window.history.replaceState(window.history.state, '', url.toString())
    }
  }, [])

  return (
    <>
      {convertedFrom && (
        <ProjectConvertedFromImportModalContent
          onHide={() => {
            setConvertedFrom(null)
          }}
        />
      )}
    </>
  )
}

function ProjectConvertedFromImportModalContent({
  onHide,
}: {
  onHide: () => void
}) {
  const { t } = useTranslation()
  const themed = useFeatureFlag('themed-modals')

  return (
    <OLModal
      show
      animation
      onHide={onHide}
      id="converted-from-document-modal"
      backdrop="static"
      themed={themed}
    >
      <OLModalHeader>
        <OLModalTitle as="h3">{t('document_ready_for_editing')}</OLModalTitle>
      </OLModalHeader>
      <OLModalBody>{t('weve_converted_your_content_to_latex')}</OLModalBody>
      <OLModalFooter>
        <OLButton variant="primary" onClick={onHide}>
          {t('start_editing')}
        </OLButton>
      </OLModalFooter>
    </OLModal>
  )
}

export default ProjectConvertedFromDocumentModal

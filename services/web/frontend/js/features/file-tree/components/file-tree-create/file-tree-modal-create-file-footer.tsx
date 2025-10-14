import { useTranslation } from 'react-i18next'
import { useFileTreeCreateForm } from '../../contexts/file-tree-create-form'
import { useFileTreeActionable } from '../../contexts/file-tree-actionable'
import OLButton from '@/shared/components/ol/ol-button'

export default function FileTreeModalCreateFileFooter() {
  const { valid } = useFileTreeCreateForm()
  const { newFileCreateMode, inFlight, cancel } = useFileTreeActionable()

  return (
    <FileTreeModalCreateFileFooterContent
      valid={valid}
      cancel={cancel}
      newFileCreateMode={newFileCreateMode}
      inFlight={inFlight}
    />
  )
}

export function FileTreeModalCreateFileFooterContent({
  valid,
  inFlight,
  cancel,
  newFileCreateMode,
}: {
  valid: boolean
  inFlight: boolean
  cancel: () => void
  newFileCreateMode?: string
}) {
  const { t } = useTranslation()

  return (
    <>
      <OLButton
        variant="secondary"
        type="button"
        disabled={inFlight}
        onClick={cancel}
      >
        {t('cancel')}
      </OLButton>

      {newFileCreateMode !== 'upload' && (
        <OLButton
          variant="primary"
          type="submit"
          form="create-file"
          disabled={inFlight || !valid}
          isLoading={inFlight}
          loadingLabel={t('creating')}
        >
          {t('create')}
        </OLButton>
      )}
    </>
  )
}

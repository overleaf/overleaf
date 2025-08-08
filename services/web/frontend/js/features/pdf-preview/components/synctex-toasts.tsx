import { GlobalToastGeneratorEntry } from '@/features/ide-react/components/global-toasts'
import { useTranslation } from 'react-i18next'
import OLButton from '@/shared/components/ol/ol-button'

export const SynctexFileErrorToast = () => {
  const { t } = useTranslation()

  return (
    <div className="synctex-error-toast-content">
      <span>{t('synctex_failed')}</span>

      <OLButton
        href="/learn/how-to/SyncTeX_Errors"
        target="_blank"
        variant="secondary"
        size="sm"
      >
        {t('more_info')}
      </OLButton>
    </div>
  )
}

export const SynctexRequestErrorToast = () => {
  const { t } = useTranslation()

  return <span>{t('synctex_error_recompile_and_try_again')}</span>
}

const generators: GlobalToastGeneratorEntry[] = [
  {
    key: 'synctex:file-error',
    generator: () => ({
      content: <SynctexFileErrorToast />,
      type: 'warning',
      autoHide: true,
      delay: 4000,
      isDismissible: true,
    }),
  },
  {
    key: 'synctex:request-error',
    generator: () => ({
      content: <SynctexRequestErrorToast />,
      type: 'warning',
      autoHide: true,
      delay: 4000,
      isDismissible: true,
    }),
  },
]

export default generators

export const showFileErrorToast = () => {
  window.dispatchEvent(
    new CustomEvent('ide:show-toast', {
      detail: {
        key: 'synctex:file-error',
      },
    })
  )
}

export const showSynctexRequestErrorToast = () => {
  window.dispatchEvent(
    new CustomEvent('ide:show-toast', {
      detail: {
        key: 'synctex:request-error',
      },
    })
  )
}

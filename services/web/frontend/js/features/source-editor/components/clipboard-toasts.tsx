import { GlobalToastGeneratorEntry } from '@/features/ide-react/components/global-toasts'
import { useTranslation } from 'react-i18next'
import { isMac } from '@/shared/utils/os'

const ClipboardPasteErrorToast = ({ shortcut }: { shortcut?: string }) => {
  const { t } = useTranslation()
  const resolvedShortcut = shortcut ?? (isMac ? '⌘V' : 'Ctrl+V')

  return (
    <>
      <p>
        <b>{t('use_the_shortcut_key_to_paste')}</b>
      </p>
      {t('your_browser_cant_access_the_clipboard_so_use_this_shortcut')}{' '}
      <b>{resolvedShortcut}</b>
      <br />
      {t('or_enable_clipboard_access_in_your_browser_settings')}
    </>
  )
}

const generators: GlobalToastGeneratorEntry[] = [
  {
    key: 'clipboard:paste-error',
    generator: ({ shortcut }: { shortcut?: string }) => ({
      content: <ClipboardPasteErrorToast shortcut={shortcut} />,
      type: 'warning',
      autoHide: true,
      delay: 6000,
      isDismissible: true,
    }),
  },
]

export default generators

export const showClipboardPasteErrorToast = (shortcut?: string) => {
  window.dispatchEvent(
    new CustomEvent('ide:show-toast', {
      detail: { key: 'clipboard:paste-error', shortcut },
    })
  )
}

import { GlobalToastGeneratorEntry } from '@/features/ide-react/components/global-toasts'
import { useTranslation } from 'react-i18next'

const stripProjectPrefix = (path: string) => path.replace(/^\/project\/?/, '')

const PythonFilesSavedToast = ({ paths }: { paths: string[] }) => {
  const { t } = useTranslation()
  if (paths.length === 1) {
    return (
      <span>
        {t('x_saved_to_your_project', {
          fileName: stripProjectPrefix(paths[0]),
        })}
      </span>
    )
  }
  return (
    <span>{t('x_files_saved_to_your_project', { count: paths.length })}</span>
  )
}

const isStringArray = (value: unknown): value is string[] =>
  Array.isArray(value) && value.every(v => typeof v === 'string')

const generators: GlobalToastGeneratorEntry[] = [
  {
    key: 'python:files-saved',
    generator: ({ paths }) => ({
      content: (
        <PythonFilesSavedToast paths={isStringArray(paths) ? paths : []} />
      ),
      type: 'success',
      autoHide: true,
      delay: 5000,
      isDismissible: true,
    }),
  },
]

export default generators

export const showPythonFilesSavedToast = (paths: string[]) => {
  window.dispatchEvent(
    new CustomEvent('ide:show-toast', {
      detail: { key: 'python:files-saved', paths },
    })
  )
}

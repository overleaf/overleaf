import { useTranslation } from 'react-i18next'
import DownloadPDF from './download-pdf'
import DownloadSource from './download-source'

export default function DownloadMenu() {
  const { t } = useTranslation()

  return (
    <>
      <h4 className="mt-0">{t('download')}</h4>
      <ul className="list-unstyled nav nav-downloads text-center">
        <li>
          <DownloadSource />
        </li>
        <li>
          <DownloadPDF />
        </li>
      </ul>
    </>
  )
}

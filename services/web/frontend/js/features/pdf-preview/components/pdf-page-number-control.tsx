import PDFToolbarButton from './pdf-toolbar-button'
import { useTranslation } from 'react-i18next'
import { useState, useEffect } from 'react'
import OLButtonGroup from '@/shared/components/ol/ol-button-group'

type PdfPageNumberControlProps = {
  setPage: (page: number) => void
  page: number
  totalPages: number
}

function PdfPageNumberControl({
  setPage,
  page,
  totalPages,
}: PdfPageNumberControlProps) {
  const { t } = useTranslation()

  const [pageInputValue, setPageInputValue] = useState(page.toString())

  useEffect(() => {
    setPageInputValue(page.toString())
  }, [page])

  const handleSubmit = (event: React.SyntheticEvent) => {
    event.preventDefault()
    const parsedValue = Number(pageInputValue)
    if (parsedValue < 1) {
      setPage(1)
      setPageInputValue('1')
    } else if (parsedValue > totalPages) {
      setPage(totalPages)
      setPageInputValue(`${totalPages}`)
    } else {
      setPage(parsedValue)
    }
  }

  return (
    <>
      <OLButtonGroup className="pdfjs-toolbar-buttons">
        <PDFToolbarButton
          tooltipId="pdf-controls-previous-page-tooltip"
          icon="keyboard_arrow_up"
          label={t('previous_page')}
          disabled={page === 1}
          onClick={() => setPage(page - 1)}
        />
        <PDFToolbarButton
          tooltipId="pdf-controls-next-page-tooltip"
          icon="keyboard_arrow_down"
          label={t('next_page')}
          disabled={page === totalPages}
          onClick={() => setPage(page + 1)}
        />
      </OLButtonGroup>
      <div className="pdfjs-page-number-input">
        <form onSubmit={handleSubmit}>
          <input
            aria-label={t('page_current', { page })}
            inputMode="numeric"
            value={pageInputValue}
            onFocus={event => event.target.select()}
            onBlur={handleSubmit}
            onChange={event => {
              const rawValue = event.target.value
              setPageInputValue(rawValue.replace(/\D/g, ''))
            }}
          />
        </form>
        <span>/ {totalPages}</span>
      </div>
    </>
  )
}

export default PdfPageNumberControl

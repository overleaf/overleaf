import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import {
  Dropdown,
  DropdownDivider,
  DropdownHeader,
  DropdownItem,
  DropdownMenu,
  DropdownToggle,
} from '@/shared/components/dropdown/dropdown-menu'
import FormControl from '@/shared/components/form/form-control'
import { isMac } from '@/shared/utils/os'
import { Shortcut } from '@/shared/components/shortcut'

const shortcuts = isMac
  ? {
      'zoom-in': ['⌘', '+'],
      'zoom-out': ['⌘', '-'],
      'fit-to-width': ['⌘', '0'],
      'fit-to-height': ['⌘', '9'],
    }
  : {
      'zoom-in': ['Ctrl', '+'],
      'zoom-out': ['Ctrl', '-'],
      'fit-to-width': ['Ctrl', '0'],
      'fit-to-height': ['Ctrl', '9'],
    }

type PdfZoomDropdownProps = {
  requestPresentationMode: () => void
  setZoom: (zoom: string) => void
  rawScale: number
}

const zoomValues = ['0.5', '0.75', '1', '1.5', '2', '4']

const rawScaleToPercentage = (rawScale: number) => {
  return `${Math.round(rawScale * 100)}%`
}

function PdfZoomDropdown({
  requestPresentationMode,
  setZoom,
  rawScale,
}: PdfZoomDropdownProps) {
  const { t } = useTranslation()

  const [customZoomValue, setCustomZoomValue] = useState<string>(
    rawScaleToPercentage(rawScale)
  )

  useEffect(() => {
    setCustomZoomValue(rawScaleToPercentage(rawScale))
  }, [rawScale])

  const showPresentOption = document.fullscreenEnabled

  return (
    <Dropdown
      onSelect={eventKey => {
        if (eventKey === 'custom-zoom') {
          return
        }

        if (eventKey === 'present') {
          requestPresentationMode()
          return
        }

        setZoom(eventKey)
      }}
      align="end"
    >
      <DropdownToggle
        id="pdf-zoom-dropdown"
        variant="link"
        className="pdf-toolbar-btn pdfjs-zoom-dropdown-button small"
        aria-label={t('pdf_zoom_level')}
      >
        {rawScaleToPercentage(rawScale)}
      </DropdownToggle>
      <DropdownMenu className="pdfjs-zoom-dropdown-menu">
        <li role="none">
          <DropdownItem
            disabled
            as="div"
            className="pdfjs-custom-zoom-menu-item"
            eventKey="custom-zoom"
          >
            <FormControl
              onFocus={event => event.target.select()}
              value={customZoomValue}
              onKeyDown={event => {
                if (event.key === 'Enter') {
                  const zoom = Number(customZoomValue.replace('%', '')) / 100

                  // Only allow zoom values between 10% and 999%
                  if (zoom < 0.1) {
                    setZoom('0.1')
                  } else if (zoom > 9.99) {
                    setZoom('9.99')
                  } else {
                    setZoom(`${zoom}`)
                  }
                }
              }}
              onChange={event => {
                const rawValue = event.target.value
                const parsedValue = rawValue.replace(/[^0-9%]/g, '')
                setCustomZoomValue(parsedValue)
              }}
            />
          </DropdownItem>
        </li>
        <DropdownDivider />
        <li role="none">
          <DropdownItem
            as="button"
            eventKey="zoom-in"
            trailingIcon={<Shortcut keys={shortcuts['zoom-in']} />}
          >
            {t('zoom_in')}
          </DropdownItem>
        </li>
        <li role="none">
          <DropdownItem
            as="button"
            eventKey="zoom-out"
            trailingIcon={<Shortcut keys={shortcuts['zoom-out']} />}
          >
            {t('zoom_out')}
          </DropdownItem>
        </li>
        <li role="none">
          <DropdownItem
            as="button"
            eventKey="page-width"
            trailingIcon={<Shortcut keys={shortcuts['fit-to-width']} />}
          >
            {t('fit_to_width')}
          </DropdownItem>
        </li>
        <li role="none">
          <DropdownItem
            as="button"
            eventKey="page-height"
            trailingIcon={<Shortcut keys={shortcuts['fit-to-height']} />}
          >
            {t('fit_to_height')}
          </DropdownItem>
        </li>
        {showPresentOption && <DropdownDivider />}
        {showPresentOption && (
          <li role="none">
            <DropdownItem as="button" eventKey="present">
              {t('presentation_mode')}
            </DropdownItem>
          </li>
        )}
        <DropdownDivider />
        <DropdownHeader aria-hidden="true">{t('zoom_to')}</DropdownHeader>
        {zoomValues.map(value => (
          <li role="none" key={value}>
            <DropdownItem as="button" eventKey={value}>
              {rawScaleToPercentage(Number(value))}
            </DropdownItem>
          </li>
        ))}
      </DropdownMenu>
    </Dropdown>
  )
}

export default PdfZoomDropdown

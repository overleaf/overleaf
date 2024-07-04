import { Dropdown, MenuItem } from 'react-bootstrap'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import ControlledDropdown from '@/shared/components/controlled-dropdown'
import classNames from 'classnames'
import { useFeatureFlag } from '@/shared/context/split-test-context'

const isMac = /Mac/.test(window.navigator?.platform)

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

  const enablePresentationMode = useFeatureFlag('pdf-presentation-mode')

  const [customZoomValue, setCustomZoomValue] = useState<string>(
    rawScaleToPercentage(rawScale)
  )

  useEffect(() => {
    setCustomZoomValue(rawScaleToPercentage(rawScale))
  }, [rawScale])

  const showPresentOption = enablePresentationMode && document.fullscreenEnabled

  return (
    <ControlledDropdown
      id="pdf-zoom-dropdown"
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
      pullRight
    >
      <Dropdown.Toggle
        bsStyle={null}
        className="btn pdf-toolbar-btn pdfjs-zoom-dropdown-button small"
        value={rawScale}
        title={rawScaleToPercentage(rawScale)}
      />
      <Dropdown.Menu className="pdfjs-zoom-dropdown-menu">
        <MenuItem
          draggable={false}
          disabled
          className="pdfjs-custom-zoom-menu-item"
          key="custom-zoom"
          eventKey="custom-zoom"
        >
          <input
            type="text"
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
        </MenuItem>
        <MenuItem divider />
        <MenuItem draggable={false} key="zoom-in" eventKey="zoom-in">
          <span>{t('zoom_in')}</span>
          <Shortcut keys={shortcuts['zoom-in']} />
        </MenuItem>
        <MenuItem draggable={false} key="zoom-out" eventKey="zoom-out">
          <span>{t('zoom_out')}</span>
          <Shortcut keys={shortcuts['zoom-out']} />
        </MenuItem>
        <MenuItem draggable={false} key="page-width" eventKey="page-width">
          {t('fit_to_width')}
          <Shortcut keys={shortcuts['fit-to-width']} />
        </MenuItem>
        <MenuItem draggable={false} key="page-height" eventKey="page-height">
          {t('fit_to_height')}
          <Shortcut keys={shortcuts['fit-to-height']} />
        </MenuItem>
        {showPresentOption && <MenuItem divider />}
        {showPresentOption && (
          <MenuItem draggable={false} key="present" eventKey="present">
            {t('presentation_mode')}
          </MenuItem>
        )}
        <MenuItem divider />
        <MenuItem header>{t('zoom_to')}</MenuItem>
        {zoomValues.map(value => (
          <MenuItem draggable={false} key={value} eventKey={value}>
            {rawScaleToPercentage(Number(value))}
          </MenuItem>
        ))}
      </Dropdown.Menu>
    </ControlledDropdown>
  )
}

function Shortcut({ keys }: { keys: string[] }) {
  return (
    <span className="pull-right">
      {keys.map((key, idx) => (
        <span
          className={classNames({
            'pdfjs-zoom-dropdown-mac-shortcut-char': key.length === 1,
          })}
          key={`${key}${idx}`}
        >
          {key}
        </span>
      ))}
    </span>
  )
}

export default PdfZoomDropdown

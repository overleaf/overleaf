import Icon from '../../../../shared/components/icon'
import useSelectColor from '../../hooks/use-select-color'
import { SketchPicker } from 'react-color'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Tooltip from '../../../../shared/components/tooltip'

const PRESET_COLORS: ReadonlyArray<{ color: string; name: string }> = [
  { color: '#A7B1C2', name: 'Grey' },
  { color: '#F04343', name: 'Red' },
  { color: '#DD8A3E', name: 'Orange' },
  { color: '#E4CA3E', name: 'Yellow' },
  { color: '#33CF67', name: 'Green' },
  { color: '#43A7F0', name: 'Light blue' },
  { color: '#434AF0', name: 'Dark blue' },
  { color: '#B943F0', name: 'Purple' },
  { color: '#FF4BCD', name: 'Pink' },
]

type ColorPickerItemProps = {
  color: string
  name: string
}

function ColorPickerItem({ color, name }: ColorPickerItemProps) {
  const { selectColor, selectedColor, pickingCustomColor } = useSelectColor()
  const { t } = useTranslation()

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      selectColor(color)
    }
  }

  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events,
      jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus */
    <div
      aria-label={`${name}, ${t('set_color')}`}
      className="color-picker-item"
      onClick={() => selectColor(color)}
      role="button"
      style={{ backgroundColor: color }}
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      <span id={name} className="sr-only">
        {t('select_color', { name })}
      </span>
      {!pickingCustomColor && color === selectedColor && (
        <Icon type="check" className="color-picker-item-icon" />
      )}
    </div>
  )
}

function MoreButton() {
  const {
    selectedColor,
    selectColor,
    showCustomPicker,
    openCustomPicker,
    closeCustomPicker,
    setPickingCustomColor,
  } = useSelectColor()
  const [localColor, setLocalColor] = useState<string>()
  const { t } = useTranslation()

  useEffect(() => {
    setLocalColor(selectedColor)
  }, [selectedColor])

  const isCustomColorSelected =
    localColor && !PRESET_COLORS.some(colorObj => colorObj.color === localColor)

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === 'Enter' || event.key === ' ') {
      showCustomPicker ? closeCustomPicker() : openCustomPicker()
    }
  }

  return (
    <div className="color-picker-more-wrapper" data-content="My Content">
      {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,
      jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus */}
      <div
        className="color-picker-item more-button"
        role="button"
        onClick={showCustomPicker ? closeCustomPicker : openCustomPicker}
        style={{
          backgroundColor: isCustomColorSelected
            ? localColor || selectedColor
            : 'white',
        }}
        tabIndex={0}
        onKeyDown={handleKeyDown}
      >
        <Tooltip
          id="tooltip-color-picker-plus"
          description={t('choose_a_custom_color')}
          overlayProps={{ delay: 0, placement: 'bottom' }}
        >
          {isCustomColorSelected ? (
            <Icon type="check" className="color-picker-item-icon" />
          ) : showCustomPicker ? (
            <Icon type="chevron-down" className="color-picker-more-open" />
          ) : (
            <Icon type="plus" className="color-picker-more" />
          )}
        </Tooltip>
      </div>
      {showCustomPicker && (
        <>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,
      jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus */}
          <div
            className="popover-backdrop"
            role="button"
            onClick={() => closeCustomPicker()}
          />
          <SketchPicker
            disableAlpha
            presetColors={[]}
            onChange={color => {
              setPickingCustomColor(true)
              setLocalColor(color.hex)
            }}
            onChangeComplete={color => {
              selectColor(color.hex)
              setPickingCustomColor(false)
            }}
            color={localColor}
            className="custom-picker"
          />
        </>
      )}
    </div>
  )
}

export function ColorPicker({
  disableCustomColor,
}: {
  disableCustomColor?: boolean
}) {
  const { selectColor, selectedColor } = useSelectColor()

  useEffect(() => {
    if (!selectedColor) {
      selectColor(
        PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)].color
      )
    }
  }, [selectColor, selectedColor])

  return (
    <>
      {PRESET_COLORS.map(({ color, name }) => (
        <ColorPickerItem color={color} name={name} key={color} />
      ))}
      {!disableCustomColor && <MoreButton />}
    </>
  )
}

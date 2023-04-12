import Icon from '../../../../shared/components/icon'
import useSelectColor from '../../hooks/use-select-color'
import { SketchPicker } from 'react-color'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import Tooltip from '../../../../shared/components/tooltip'

const PRESET_COLORS: ReadonlyArray<string> = [
  '#A7B1C2',
  '#F04343',
  '#DD8A3E',
  '#E4CA3E',
  '#33CF67',
  '#43A7F0',
  '#434AF0',
  '#B943F0',
  '#FF4BCD',
]

type ColorPickerItemProps = {
  color: string
}

function ColorPickerItem({ color }: ColorPickerItemProps) {
  const { selectColor, selectedColor, pickingCustomColor } = useSelectColor()

  return (
    /* eslint-disable-next-line jsx-a11y/click-events-have-key-events,
      jsx-a11y/no-static-element-interactions, jsx-a11y/interactive-supports-focus */
    <div
      className="color-picker-item"
      role="button"
      style={{ backgroundColor: color }}
      onClick={() => selectColor(color)}
    >
      {!pickingCustomColor && color === selectedColor && (
        <Icon type="check" className="color-picker-item-icon" />
      )}
    </div>
  )
}

function MoreButton() {
  const { t } = useTranslation()
  const {
    selectedColor,
    selectColor,
    showCustomPicker,
    openCustomPicker,
    closeCustomPicker,
    setPickingCustomColor,
  } = useSelectColor()
  const [localColor, setLocalColor] = useState<string>()

  useEffect(() => {
    setLocalColor(selectedColor)
  }, [selectedColor])

  const isCustomColorSelected =
    localColor && !PRESET_COLORS.includes(localColor)

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
        PRESET_COLORS[Math.floor(Math.random() * PRESET_COLORS.length)]
      )
    }
  }, [selectColor, selectedColor])

  return (
    <>
      {PRESET_COLORS.map(hexColor => (
        <ColorPickerItem color={hexColor} key={hexColor} />
      ))}
      {!disableCustomColor && <MoreButton />}
    </>
  )
}

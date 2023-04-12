import { useEffect } from 'react'
import { useColorPickerContext } from '../context/color-picker-context'

export default function useSelectColor(defaultColor?: string) {
  const {
    selectedColor,
    setSelectedColor,
    showCustomPicker,
    setShowCustomPicker,
    pickingCustomColor,
    setPickingCustomColor,
  } = useColorPickerContext()

  useEffect(() => {
    setSelectedColor(defaultColor)
  }, [defaultColor, setSelectedColor])

  const selectColor = (color: string) => {
    setSelectedColor(color)
  }

  const openCustomPicker = () => {
    setShowCustomPicker(true)
  }

  const closeCustomPicker = () => {
    setShowCustomPicker(false)
  }

  return {
    selectedColor,
    selectColor,
    showCustomPicker,
    openCustomPicker,
    closeCustomPicker,
    pickingCustomColor,
    setPickingCustomColor,
  }
}

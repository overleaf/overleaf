import { createContext, ReactNode, useContext, useMemo, useState } from 'react'

export type ColorPickerContextValue = {
  selectedColor?: string
  setSelectedColor: (color?: string) => void
  showCustomPicker: boolean
  setShowCustomPicker: (show: boolean) => void
  pickingCustomColor: boolean
  setPickingCustomColor: (picking: boolean) => void
}

export const ColorPickerContext = createContext<
  ColorPickerContextValue | undefined
>(undefined)

type ColorPickerProviderProps = {
  children: ReactNode
}

export function ColorPickerProvider({ children }: ColorPickerProviderProps) {
  const [selectedColor, setSelectedColor] = useState<string | undefined>()
  const [showCustomPicker, setShowCustomPicker] = useState(false)
  const [pickingCustomColor, setPickingCustomColor] = useState(false)

  const value = useMemo<ColorPickerContextValue>(
    () => ({
      pickingCustomColor,
      selectedColor,
      setPickingCustomColor,
      setSelectedColor,
      setShowCustomPicker,
      showCustomPicker,
    }),
    [
      pickingCustomColor,
      selectedColor,
      setPickingCustomColor,
      setSelectedColor,
      setShowCustomPicker,
      showCustomPicker,
    ]
  )

  return (
    <ColorPickerContext.Provider value={value}>
      {children}
    </ColorPickerContext.Provider>
  )
}

export function useColorPickerContext() {
  const context = useContext(ColorPickerContext)
  if (!context) {
    throw new Error(
      'ColorPickerContext is only available inside ColorPickerProvider'
    )
  }
  return context
}

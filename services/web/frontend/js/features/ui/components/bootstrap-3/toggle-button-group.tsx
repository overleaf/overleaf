import {
  Children,
  cloneElement,
  isValidElement,
  useState,
  useEffect,
} from 'react'
import {
  ToggleButtonGroup as BS3ToggleButtonGroup,
  ToggleButtonGroupProps as BS3ToggleButtonGroupProps,
  ToggleButtonProps as BS3ToggleButtonProps,
} from 'react-bootstrap'

function ToggleButtonGroup<T extends string | number>({
  children,
  value,
  defaultValue,
  onChange,
  ...props
}: BS3ToggleButtonGroupProps) {
  const [selectedValue, setSelectedValue] = useState<T | T[] | null>(
    defaultValue || (props.type === 'checkbox' ? [] : null)
  )
  const isControlled = value !== undefined

  useEffect(() => {
    if (isControlled) {
      if (props.type === 'radio') {
        setSelectedValue(value)
      } else {
        if (Array.isArray(value)) {
          setSelectedValue(Array.from(value))
        } else {
          setSelectedValue([value])
        }
      }
    }
  }, [isControlled, value, props.type])

  const handleButtonClick = (buttonValue: T) => {
    if (props.type === 'radio') {
      if (!isControlled) {
        setSelectedValue(buttonValue)
      }

      onChange?.(buttonValue as any)
    } else if (props.type === 'checkbox') {
      const newValue = Array.isArray(selectedValue)
        ? selectedValue.includes(buttonValue)
          ? selectedValue.filter(val => val !== buttonValue) // Deselect
          : [...selectedValue, buttonValue] // Select
        : [buttonValue] // Initial selection if value is not array yet

      if (!isControlled) {
        setSelectedValue(newValue)
      }

      onChange?.(newValue)
    }
  }

  // Clone children and add custom onClick handlers
  const modifiedChildren = Children.map(children, child => {
    if (isValidElement(child)) {
      const childElement = child as React.ReactElement<
        BS3ToggleButtonProps & { active?: boolean }
      >

      const isActive =
        props.type === 'radio'
          ? selectedValue === childElement.props.value
          : Array.isArray(selectedValue) &&
            selectedValue.includes(childElement.props.value as T)

      return cloneElement(childElement, {
        onClick: () => {
          handleButtonClick(childElement.props.value as T)
        },
        active: isActive,
      })
    }

    return child
  })

  return (
    <BS3ToggleButtonGroup
      {...props}
      value={isControlled ? value : undefined}
      defaultValue={defaultValue}
      // Ignore the broken onChange handler
      onChange={() => {}}
    >
      {modifiedChildren}
    </BS3ToggleButtonGroup>
  )
}

export default ToggleButtonGroup

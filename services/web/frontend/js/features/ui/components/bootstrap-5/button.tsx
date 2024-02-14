import { Button as BootstrapButton } from 'react-bootstrap-5'
import type { ButtonProps } from '@/features/ui/components/types/button-props'

const sizeClasses = new Map<ButtonProps['size'], string>([
  ['small', 'btn-sm'],
  ['default', ''],
  ['large', 'btn-lg'],
])

// TODO: Display a spinner when `loading` is true
function Button({
  variant = 'primary',
  size = 'default',
  disabled = false,
  loading = false,
  children,
}: ButtonProps) {
  const sizeClass = sizeClasses.get(size)

  return (
    <BootstrapButton
      variant={variant}
      className={sizeClass}
      disabled={disabled}
      {...(loading ? { 'data-ol-loading': true } : null)}
    >
      {children}
    </BootstrapButton>
  )
}

export default Button

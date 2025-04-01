import IconButton from '@/features/ui/components/bootstrap-5/icon-button'

type BackButtonProps = {
  href: string
  accessibilityLabel: string
}

function BackButton({ href, accessibilityLabel }: BackButtonProps) {
  return (
    <IconButton
      variant="ghost"
      href={href}
      size="lg"
      icon="arrow_back"
      accessibilityLabel={accessibilityLabel}
    />
  )
}

export default BackButton

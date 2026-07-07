import OLIconButton from '@/shared/components/ol/ol-icon-button'

type BackButtonProps = {
  href: string
  accessibilityLabel: string
}

function BackButton({ href, accessibilityLabel }: BackButtonProps) {
  return (
    <OLIconButton
      variant="ghost"
      href={href}
      size="lg"
      icon="arrow_back"
      accessibilityLabel={accessibilityLabel}
    />
  )
}

export default BackButton

import MaterialIcon from '@/shared/components/material-icon'
import IconButton from '@/features/ui/components/bootstrap-5/icon-button'
import BootstrapVersionSwitcher from '@/features/ui/components/bootstrap-5/bootstrap-version-switcher'

type BackButtonProps = {
  href: string
  accessibilityLabel: string
}

function BackButton({ href, accessibilityLabel }: BackButtonProps) {
  return (
    <BootstrapVersionSwitcher
      bs3={
        <a href={href} className="back-btn">
          <MaterialIcon
            type="arrow_back"
            accessibilityLabel={accessibilityLabel}
          />
        </a>
      }
      bs5={
        <IconButton
          variant="ghost"
          href={href}
          size="lg"
          icon="arrow_back"
          accessibilityLabel={accessibilityLabel}
        />
      }
    />
  )
}

export default BackButton

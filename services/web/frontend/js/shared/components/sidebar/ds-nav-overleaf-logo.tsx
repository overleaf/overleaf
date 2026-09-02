import { useActiveOverallTheme } from '@/shared/hooks/use-active-overall-theme'
import getMeta from '@/utils/meta'
import overleafLogo from '@/shared/svgs/overleaf-a-ds-solution-mallard.svg'
import overleafLogoDark from '@/shared/svgs/overleaf-a-ds-solution-mallard-dark.svg'

export function DsNavOverleafLogo() {
  const appName = getMeta('ol-ExposedSettings')?.appName ?? 'Overleaf'
  const activeOverallTheme = useActiveOverallTheme()

  return (
    <div className="ds-nav-page-switcher-logo">
      <a href="/" aria-label={appName}>
        <img
          src={activeOverallTheme === 'dark' ? overleafLogoDark : overleafLogo}
          alt="Overleaf, A Digital Science Solution"
          height="59"
          width="130"
        />
      </a>
    </div>
  )
}

import classNames from 'classnames'
import overleafLogo from '@/shared/svgs/overleaf-green.svg'

type InterstitialProps = {
  className?: string
  contentClassName?: string
  children: React.ReactNode
  showLogo: boolean
  title?: string
}

export function Interstitial({
  className,
  contentClassName,
  children,
  showLogo,
  title,
}: InterstitialProps) {
  return (
    <div className={classNames('interstitial', className)}>
      {showLogo && <img className="logo" src={overleafLogo} alt="Overleaf" />}
      {title && <h1 className="h3 interstitial-header">{title}</h1>}
      <div className={classNames(contentClassName)}>{children}</div>
    </div>
  )
}

import React, { FC, ReactNode } from 'react'
import overleafLogo from '@/shared/svgs/overleaf-a-ds-solution-mallard.svg'

type Props = { children: ReactNode }

const CiamLayout: FC<Props> = ({ children }: Props) => (
  <div className="ciam-layout ciam-enabled">
    <a
      href="/"
      aria-label="Overleaf"
      className="brand"
      style={{ backgroundImage: `url("${overleafLogo}")` }}
    />
    <div className="ciam-container">
      <main className="ciam-card" id="main-content">
        {children}
      </main>
    </div>
    <footer>
      <a href="https://www.overleaf.com/legal#Privacy">Privacy</a>
      <a href="https://www.overleaf.com/legal#Terms">Terms</a>
    </footer>
  </div>
)

export default CiamLayout

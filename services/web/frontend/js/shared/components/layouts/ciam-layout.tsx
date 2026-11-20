import React, { FC, ReactNode } from 'react'
import { Trans } from 'react-i18next'
import * as eventTracking from '@/infrastructure/event-tracking'

type Props = { children: ReactNode }

const CiamLayout: FC<Props> = ({ children }: Props) => (
  <div className="ciam-layout ciam-enabled">
    <header className="ciam-logo">
      <a href="/" className="brand overleaf-ds-logo ciam-image-link">
        <span className="visually-hidden">Overleaf</span>
      </a>
    </header>
    <div className="ciam-container">
      <main className="ciam-card" id="main-content">
        {children}
        <section className="ciam-card-footer">
          <hr className="ciam-card-separator" />

          <p>
            <Trans
              i18nKey="advancing_research_with"
              components={[
                // eslint-disable-next-line jsx-a11y/anchor-has-content,react/jsx-key
                <a
                  href="https://www.overleaf.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    eventTracking.sendMB('unified-access-footer-click', {
                      product: 'overleaf',
                      item: 'overleaf',
                      destinationUrl: 'https://www.overleaf.com/',
                    })
                  }
                />,
                // eslint-disable-next-line jsx-a11y/anchor-has-content,react/jsx-key
                <a
                  href="https://www.readcube.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    eventTracking.sendMB('unified-access-footer-click', {
                      product: 'overleaf',
                      item: 'papers',
                      destinationUrl: 'https://www.readcube.com/',
                    })
                  }
                />,
              ]}
            />
          </p>
        </section>
      </main>
    </div>
    <footer>
      <div className="footer-links">
        <a href="https://www.overleaf.com/legal#Privacy">Privacy</a>
        <a href="https://www.overleaf.com/legal#Terms">Terms</a>
      </div>
    </footer>
  </div>
)

export default CiamLayout

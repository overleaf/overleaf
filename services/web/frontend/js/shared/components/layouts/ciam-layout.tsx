import React, { FC, ReactNode } from 'react'
import { Trans } from 'react-i18next'
import * as eventTracking from '@/infrastructure/event-tracking'
import dsLogo from '@/shared/svgs/digital-science.svg'

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
          <div className="ciam-footer-ds-logo">
            <a
              href="https://www.digital-science.com/"
              target="_blank"
              rel="noopener noreferrer"
              className="ciam-image-link"
              onClick={() =>
                eventTracking.sendMB('unified-access-footer-click', {
                  product: 'overleaf',
                  item: 'logo',
                  destinationUrl: 'https://www.digital-science.com/',
                })
              }
            >
              <img src={dsLogo} alt="Digital Science — home" />
            </a>
          </div>
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
                  href="https://www.papersapp.com/"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() =>
                    eventTracking.sendMB('unified-access-footer-click', {
                      product: 'overleaf',
                      item: 'papers',
                      destinationUrl: 'https://www.papersapp.com/',
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

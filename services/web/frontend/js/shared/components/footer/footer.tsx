import { FooterMetadata } from '@/shared/components/types/footer-metadata'
import ThinFooter from '@/shared/components/footer/thin-footer'
import FatFooter from '@/shared/components/footer/fat-footer'

function Footer(props: FooterMetadata) {
  return props.showThinFooter ? <ThinFooter {...props} /> : <FatFooter />
}

export default Footer

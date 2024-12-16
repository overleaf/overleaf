import { FooterMetadata } from '@/features/ui/components/types/footer-metadata'
import ThinFooter from '@/features/ui/components/bootstrap-5/footer/thin-footer'
import FatFooter from '@/features/ui/components/bootstrap-5/footer/fat-footer'

function Footer(props: FooterMetadata) {
  return props.showThinFooter ? <ThinFooter {...props} /> : <FatFooter />
}

export default Footer

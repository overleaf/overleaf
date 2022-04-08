import { UserEmailData } from '../../../../../../types/user-email'
import { Row, Col } from 'react-bootstrap'
import Email from './email'
import EmailCell from './cell'

type EmailsRowProps = {
  userEmailData: UserEmailData
}

function EmailsRow({ userEmailData }: EmailsRowProps) {
  return (
    <Row>
      <Col sm={5}>
        <EmailCell>
          <Email userEmailData={userEmailData} />
        </EmailCell>
      </Col>
      <Col sm={5}>
        <EmailCell>todo</EmailCell>
      </Col>
      <Col sm={2}>
        <EmailCell>todo</EmailCell>
      </Col>
    </Row>
  )
}

export default EmailsRow

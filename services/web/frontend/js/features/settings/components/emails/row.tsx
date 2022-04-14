import { UserEmailData } from '../../../../../../types/user-email'
import { Row, Col } from 'react-bootstrap'
import Email from './email'
import InstitutionAndRole from './institution-and-role'
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
        {userEmailData.affiliation?.institution && (
          <EmailCell>
            <InstitutionAndRole userEmailData={userEmailData} />
          </EmailCell>
        )}
      </Col>
      <Col sm={2}>
        <EmailCell>todo</EmailCell>
      </Col>
    </Row>
  )
}

export default EmailsRow

import { Container, Row, Col } from 'react-bootstrap'
import { Meta } from '@storybook/react'

type Args = React.ComponentProps<typeof Row>

export const ColumnRowCell = (args: Args) => {
  return (
    <Container style={{ border: '3px solid green' }}>
      <Row {...args} style={{ border: '1px solid black' }}>
        <Col sm={6} style={{ border: '1px solid red' }}>
          <div style={{ backgroundColor: '#ddd' }}>Col 1</div>
        </Col>
        <Col sm={6} style={{ border: '1px solid red' }}>
          <div style={{ backgroundColor: '#ddd' }}>Col 2</div>
        </Col>
        <Col sm={{ span: 10, offset: 2 }} style={{ border: '1px solid red' }}>
          <div style={{ backgroundColor: '#ddd' }}>Col 3</div>
        </Col>
      </Row>
    </Container>
  )
}

const meta: Meta<typeof Row> = {
  title: 'Shared / Components / Column-Row-Cell',
  component: Row,
}

export default meta

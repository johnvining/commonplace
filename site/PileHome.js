import React from 'react'
import * as db from './Database'
import PileList from './PileList'

class PileHome extends React.Component {
  async componentDidMount() {}

  componentDidUpdate(prevState) {}

  getListOfPiles() {
    return db.getAllPiles()
  }

  render() {
    this.props.setPageTitle('Piles')
    return (
      <div>
        <div align="right">
          <PileList
            key={'pileList'}
            getListOfPiles={this.getListOfPiles.bind(this)}
          />
        </div>
      </div>
    )
  }
}

export default PileHome

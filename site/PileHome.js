import React from 'react'
import * as db from './Database'
import PileList from './PileList'

class PileHome extends React.Component {
  async componentDidMount() {}

  getListOfPiles() {
    return db.getAllPiles()
  }

  render() {
    this.props.setPageTitle('Piles')
    return (
      <div>
        <div>
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

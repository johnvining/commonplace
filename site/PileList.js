import React from 'react'
import { Link } from '@reach/router'
import pile_img from './icons/stack.svg'
import work_img from './icons/work.svg'
import note_img from './icons/write.svg'

class PileList extends React.Component {
  state = {}

  async componentDidMount() {
    const response = await this.props.getListOfPiles()
    this.setState({
      piles: response.data.data
    })
  }

  render() {
    return (
      <div className="pile-list">
        {this.state.piles === undefined
          ? null
          : this.state.piles.map((pile, index) => {
              return (
                <Link to={`/pile/${pile._id}`} key={'pile-list-' + pile._id}>
                  <div className="result-box">
                    <div className="result-box header">
                      <img src={pile_img} />
                      <div>{pile.name}</div>
                    </div>
                    {pile.note_count || pile.work_count ? (
                      <div className="result-box content">
                        {pile.note_count ? (
                          <>
                            <img src={note_img} />
                            {pile.note_count}
                          </>
                        ) : null}
                        {pile.work_count ? (
                          <>
                            <img src={work_img} />
                            {pile.work_count}
                          </>
                        ) : null}
                      </div>
                    ) : null}
                  </div>
                </Link>
              )
            })}
      </div>
    )
  }
}

export default PileList

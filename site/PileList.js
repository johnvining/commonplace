import React from 'react'
import { Link } from 'react-router-dom'
import pile_img from 'url:./icons/stack.svg'
import work_img from 'url:./icons/work.svg'
import note_img from 'url:./icons/write.svg'
import PinButton from './PinButton'

class PileList extends React.Component {
  state = {}

  async componentDidMount() {
    const response = await this.props.getListOfPiles()
    this.setState({
      piles: response.data.data,
    })
  }

  render() {
    return (
      <div className="pile-list">
        {this.state.piles === undefined ? null : this.state.piles.length === 0 ? (
          <div className="search-empty-state">No piles found.</div>
        ) : (this.props.limit ? this.state.piles.slice(0, this.props.limit) : this.state.piles).map((pile) => {
              return (
                <Link to={`/pile/${pile._id}`} key={'pile-list-' + pile._id}>
                  <div className="result-box">
                    <div className="result-box header">
                      <img src={pile_img} />
                      <div>{pile.name}</div>
                      <PinButton
                        type="pile"
                        id={pile._id}
                        label={pile.name}
                        href={`/pile/${pile._id}`}
                        compact={true}
                        className="pin-button-inline"
                      />
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

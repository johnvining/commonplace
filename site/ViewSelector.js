import React from 'react'
import * as constants from './constants'
import full from './icons/full.svg'
import slim from './icons/slim.svg'
import grid from './icons/grid.svg'

class SearchBar extends React.Component {
  render() {
    return (
      <>
        <button
          className={
            this.props.viewMode == constants.view_modes.FULL
              ? 'button-selected left'
              : 'button left'
          }
          onClick={() => {
            this.props.setView(constants.view_modes.FULL)
          }}
        >
          <img src={full} />
        </button>
        <button
          className={
            this.props.viewMode == constants.view_modes.SLIM
              ? 'button-selected'
              : 'button'
          }
          onClick={() => {
            this.props.setView(constants.view_modes.SLIM)
          }}
        >
          <img src={slim} />
        </button>
        <button
          className={
            this.props.viewMode == constants.view_modes.GRID
              ? 'button-selected right'
              : 'button right'
          }
          onClick={() => {
            this.props.setView(constants.view_modes.GRID)
          }}
        >
          <img src={grid} />
        </button>
      </>
    )
  }
}

export default SearchBar

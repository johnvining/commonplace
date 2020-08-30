import React from 'react'
import * as constants from './constants'
import full from './icons/full.svg'
import slim from './icons/slim.svg'
import grid from './icons/grid.svg'

class SearchBar extends React.Component {
  render() {
    return (
      <div>
        <button
          className={
            this.props.viewMode == constants.view_modes.FULL
              ? 'toolbar-selected left'
              : 'toolbar left'
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
              ? 'toolbar-selected'
              : 'toolbar'
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
              ? 'toolbar-selected right'
              : 'toolbar right'
          }
          onClick={() => {
            this.props.setView(constants.view_modes.GRID)
          }}
        >
          <img src={grid} />
        </button>
      </div>
    )
  }
}

export default SearchBar

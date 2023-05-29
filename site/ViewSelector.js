import React from 'react'
import * as constants from './constants'
import full from './icons/full.svg'
import slim from './icons/slim.svg'
import grid from './icons/grid.svg'

class SearchBar extends React.Component {
  componentDidMount() {
    this.keyDownListener = this.handleKeyDown.bind(this)
    document.addEventListener('keydown', this.keyDownListener, false)
  }

  handleKeyDown(event) {
    if (event.ctrlKey) {
      switch (event.keyCode) {
        case constants.keyCodes.full:
          this.props.setView(constants.view_modes.FULL)
          break
        case constants.keyCodes.slim:
          this.props.setView(constants.view_modes.SLIM)
          break
        case constants.keyCodes.grid:
          this.props.setView(constants.view_modes.GRID)
          break
      }
    }
  }

  render() {
    return (
      <>
        <button
          className={
            this.props.viewMode == constants.view_modes.FULL
              ? 'standard-button button-selected left'
              : 'standard-button left'
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
              ? 'standard-button button-selected middle'
              : 'standard-button middle'
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
              ? 'standard-button button-selected right'
              : 'standard-button right'
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

import React from 'react'
import * as constants from './constants'
import full from 'url:./icons/full.svg'
import slim from 'url:./icons/slim.svg'
import grid from 'url:./icons/grid.svg'
import gridSmall from 'url:./icons/grid_small.svg'

// View mode shortcuts (Ctrl+Shift+1/2/3/4) are handled globally in App.js
// This component only renders the view mode buttons

class ViewSelector extends React.Component {
  render() {
    return (
      <>
        <button
          className={
            this.props.viewMode == constants.view_modes.FULL
              ? 'button button-selected left'
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
              ? 'button button-selected middle'
              : 'button middle'
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
              ? 'button button-selected middle'
              : 'button middle'
          }
          onClick={() => {
            this.props.setView(constants.view_modes.GRID)
          }}
        >
          <img src={grid} />
        </button>
        <button
          className={
            this.props.viewMode == constants.view_modes.TILE
              ? 'button button-selected right'
              : 'button right'
          }
          onClick={() => {
            this.props.setView(constants.view_modes.TILE)
          }}
        >
          <img src={gridSmall} />
        </button>
      </>
    )
  }
}

export default ViewSelector

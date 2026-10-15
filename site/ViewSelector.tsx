import React from 'react'
import * as constants from './constants'
import full from 'url:./icons/full.svg'
import slim from 'url:./icons/slim.svg'
import grid from 'url:./icons/grid.svg'
import gridSmall from 'url:./icons/grid_small.svg'
import { TopLevelStandardButton } from './TopLevelStandardButton'

// View mode shortcuts (Ctrl+Shift+1/2/3/4) are handled globally in App.js
// This component only renders the view mode buttons

const VIEWS = [
  { mode: constants.view_modes.FULL, icon: full, label: 'Full view (Ctrl-Shift-1)', position: 'left' },
  { mode: constants.view_modes.SLIM, icon: slim, label: 'Slim view (Ctrl-Shift-2)', position: 'middle' },
  { mode: constants.view_modes.GRID, icon: grid, label: 'Grid view (Ctrl-Shift-3)', position: 'middle' },
  { mode: constants.view_modes.TILE, icon: gridSmall, label: 'Tile view (Ctrl-Shift-4)', position: 'right' },
]

class ViewSelector extends React.Component<any> {
  render() {
    return (
      <>
        {VIEWS.map(({ mode, icon, label, position }) => (
          <TopLevelStandardButton
            key={mode}
            label={label}
            position={position}
            className={this.props.viewMode == mode ? 'button-selected' : undefined}
            onClick={() => this.props.setView(mode)}
          >
            <img src={icon} alt="" />
          </TopLevelStandardButton>
        ))}
      </>
    )
  }
}

export default ViewSelector

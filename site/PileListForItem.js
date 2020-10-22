import React from 'react'
import Autocomplete from './Autocomplete'
import { navigate } from '@reach/router'

class PileListForItem extends React.Component {
  render() {
    return (
      <>
        {this.props.piles?.map(pile => (
          <button
            key={'/pile/' + pile._id}
            className={this.props.remove ? 'pile label remove' : 'pile label'}
            onClick={() => {
              if (this.props.remove) {
                this.props.onPileRemove(pile._id)
              } else {
                navigate('/pile/' + pile._id)
              }
            }}
          >
            {pile.name}
          </button>
        ))}
        {this.props.edit ? (
          <Autocomplete
            className={this.props.mainClassName + ' pile-select'}
            clearOnSelect={true}
            defaultValue=""
            dontAutofocus={false}
            escape={this.props.escape}
            getSuggestions={this.props.getSuggestions}
            handleNewSelect={this.props.handleNewSelect.bind(this)}
            inputName="work-pile"
            onSelect={this.props.onSelect.bind(this)}
            excludeIds={this.props.piles.map(pile => pile._id)}
          />
        ) : (
          <button
            className="pile-select button"
            onClick={this.props.onStartPileEdit}
            disabled={!this.props.allowAdd}
            tabIndex={this.props.allowTabbing ? '' : '-1'}
          >
            +
          </button>
        )}
      </>
    )
  }
}

export default PileListForItem

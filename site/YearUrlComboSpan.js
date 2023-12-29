import React from 'react'
import YearSpan from './YearSpan'

function YearUrlComboSpan(props) {
  return (
    <>
      {props.year && !props.url && (
        <span>
          {' '}
          (<YearSpan year={props.year} />)
        </span>
      )}
      {props.year && props.url && (
        <span>
          {' '}
          (
          <a href={props.url}>
            <YearSpan year={props.year} />
          </a>
          )
        </span>
      )}
      {props.url && !props.year && (
        <span>
          {' '}
          (<a href={props.url}>link</a>)
        </span>
      )}
    </>
  )
}

export default YearUrlComboSpan

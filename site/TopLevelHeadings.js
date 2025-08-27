import React from 'react'

export function TopLevelTitleContainer(props) {
  return <div className="top-level container">{props.children}</div>
}

export function TopLevelTitle(props) {
  return <div className={'top-level title'}>{props.children}</div>
}

export function TopLevelSubTitle(props) {
  return <div className={'top-level sub-title'}>{props.children}</div>
}

export function TopLevelPostButtonContent(props) {
  return <div className="top-level post-button-content">{props.children}</div>
}

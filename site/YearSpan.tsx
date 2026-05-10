import React from 'react'

interface YearSpanProps {
  year?: number | string
  parens?: boolean
  spanStyle?: string
}

class YearSpan extends React.Component<YearSpanProps> {
  formatYear(year: any) {
    if (year < 0) {
      year = year * -1 + ' BC'
    }

    if (this.props.parens) {
      return '(' + year + ')'
    } else {
      return year
    }
  }

  render() {
    var year = this.formatYear(this.props.year)
    return <span className={this.props.spanStyle}>{year}</span>
  }
}

export default YearSpan

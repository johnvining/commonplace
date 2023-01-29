import React from 'react'
class YearSpan extends React.Component {
  formatYear(year) {
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

import React from 'react'
import { Link } from '@reach/router'
import author_img from './icons/author.svg'

class AuthorList extends React.Component {
  state = {}

  async componentDidMount() {
    const response = await this.props.getListOfAuthors()
    this.setState({
      authors: response.data.data
    })
  }

  render() {
    return (
      <div className="author-list">
        {this.state.authors === undefined ? null : (
          <div>
            {this.state.authors.map((author, index) => {
              return (
                <Link
                  to={`/auth/${author._id}`}
                  key={'author-list-' + author._id}
                >
                  <div className="result-box">
                    <img src={author_img} />

                    {author.name}
                  </div>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }
}

export default AuthorList

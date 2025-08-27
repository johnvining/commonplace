import React from 'react'
import { Link } from 'react-router-dom'
import author_img from 'url:./icons/author.svg'
import note_img from 'url:./icons/write.svg'
import work_img from 'url:./icons/work.svg'

class AuthorList extends React.Component {
  state = {}

  async componentDidMount() {
    const response = await this.props.getListOfAuthors()
    this.setState({
      authors: response.data.data,
    })
  }

  render() {
    return (
      <div className="author-list">
        {this.state.authors === undefined ? null : (
          <div>
            {this.state.authors.map((author) => {
              return (
                <Link
                  to={`/auth/${author._id}`}
                  key={'author-list-' + author._id}
                >
                  <div className="result-box">
                    <div className="result-box header">
                      <img src={author_img} />

                      {author.name}
                    </div>

                    {author.note_count || author.note_count ? (
                      <div className="result-box content">
                        {author.note_count ? (
                          <>
                            <img src={note_img} />
                            {author.note_count}
                          </>
                        ) : null}
                        {author.work_count ? (
                          <>
                            <img src={work_img} />
                            {author.work_count}
                          </>
                        ) : null}
                      </div>
                    ) : null}
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

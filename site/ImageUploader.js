import React from 'react'
import upload from './icons/upload.svg'

class ImageUploader extends React.Component {
  state = { selectedFile: '', ready: false, uploading: false }

  onFileSelect(event) {
    this.setState({
      selectedFile: event.target.files[0],
      ready: true
    })
  }

  onSubmit() {
    this.setState({ ready: false, uploading: true }, () => {
      this.props.onImageUpload(this.state.selectedFile).then(() => {
        fileUploadInput.value = ''
        this.setState({ uploading: false, selectedFile: '' })
      })
    })
  }

  render() {
    return (
      <div className="inline">
        <div className="inline">
          {this.state.ready ? (
            <button
              onClick={this.onSubmit.bind(this)}
              className="action-bar action-button"
            >
              <img src={upload} />
            </button>
          ) : null}

          {this.state.uploading ? <em>Uploading...</em> : null}
        </div>
        <div className="inline">
          <form className="upload-form">
            <input
              type="file"
              name="file"
              id="fileUploadInput"
              onChange={this.onFileSelect.bind(this)}
            />
          </form>
        </div>
      </div>
    )
  }
}

export default ImageUploader

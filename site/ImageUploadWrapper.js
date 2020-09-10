import React from 'react'
import ImageUploader from 'react-images-upload'
import * as db from './Database'
import upload from './icons/upload.svg'

class ImageUploadWrapper extends React.Component {
  state = { selectedFile: '', ready: false, uploading: false }

  onFileSelect(event) {
    this.setState({
      selectedFile: event.target.files[0],
      ready: true
    })
  }

  onSubmit() {
    this.setState({ ready: false, uploading: true }, () => {
      db.addImageToNote(1231331, this.state.selectedFile).then(() => {
        fileUploadInput.value = ''
        this.setState({ uploading: false, selectedFile: '' })
      })
    })
  }

  render() {
    return (
      <div>
        <form>
          <input
            type="file"
            name="file"
            id="fileUploadInput"
            onChange={this.onFileSelect.bind(this)}
          />
        </form>
        {this.state.ready ? (
          <button onClick={this.onSubmit.bind(this)}>
            <img src={upload} />
          </button>
        ) : null}
        {this.state.uploading ? <em>Uploading...</em> : null}
      </div>
    )
  }
}

export default ImageUploadWrapper

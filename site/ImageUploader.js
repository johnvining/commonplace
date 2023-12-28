import React from 'react'
import upload from './icons/upload.svg'

class ImageUploader extends React.Component {
  state = {
    selectedFile: '',
    ready: false,
    uploading: false,
    dragActive: false,
  }

  onFileSelect(event) {
    this.setState(
      {
        selectedFile: event.target.files[0],
        ready: true,
      },
      () => {
        this.onSubmit() // yolo
      }
    )
  }

  onSubmit() {
    this.setState({ ready: false, uploading: true }, () => {
      this.props.onImageUpload(this.state.selectedFile).then(() => {
        // eslint-disable-next-line no-undef
        fileUploadInput.value = '' // TODO: Fix this -- working but janky
        this.setState({ uploading: false, selectedFile: '' })
      })
    })
  }

  handleDragEnter(e) {
    this.setState({ dragActive: true })
    e.preventDefault()
    e.stopPropagation()
  }
  handleDragLeave(e) {
    this.setState({ dragActive: false })
    e.preventDefault()
    e.stopPropagation()
  }
  handleDragOver(e) {
    this.setState({ dragActive: true })
    e.preventDefault()
    e.stopPropagation()
  }
  handleDrop(e) {
    this.setState({ dragActive: false })
    e.preventDefault()
    e.stopPropagation()

    const { files } = e.dataTransfer

    if (files && files.length == 1) {
      // TODO: Support for multi-file
      this.setState({ selectedFile: files[0], ready: true }, () => {
        this.onSubmit()
      })
    }
  }

  render() {
    return (
      <div
        className={'file-drop' + (this.state.dragActive ? ' drag-active' : '')}
        onDrop={this.handleDrop.bind(this)}
        onDragOver={this.handleDragOver.bind(this)}
        onDragEnter={this.handleDragEnter.bind(this)}
        onDragLeave={this.handleDragLeave.bind(this)}
      >
        <div className="inline">
          {this.state.ready ? (
            <button
              onClick={this.onSubmit.bind(this)}
              className="action-bar action-button"
            >
              <img src={upload} />
            </button>
          ) : null}

          {/* {this.state.uploading ? <em>Uploading...</em> : null} */}
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

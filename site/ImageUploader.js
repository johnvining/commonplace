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
      <form className="upload-form">
        <input
          className="upload-form hidden"
          type="file"
          name="file"
          id="fileUploadInput"
          onChange={this.onFileSelect.bind(this)}
          title="asdfsdf"
        />
        <label
          htmlFor="fileUploadInput"
          className="upload-label left-right"
          onBlur={this.onFileSelect.bind(this)}
        >
          <div
            className={
              'file-drop' +
              (this.state.dragActive ? ' drag-active' : '') +
              (this.props.noMarginNoBorders ? ' no-margin-no-border' : '')
            }
            onDrop={this.handleDrop.bind(this)}
            onDragOver={this.handleDragOver.bind(this)}
            onDragEnter={this.handleDragEnter.bind(this)}
            onDragLeave={this.handleDragLeave.bind(this)}
          >
            {!this.state.dragActive
              ? 'Upload Image'
              : this.state.uploading
              ? 'Uploading'
              : 'Drop Image'}
          </div>
        </label>
      </form>
    )
  }
}

export default ImageUploader

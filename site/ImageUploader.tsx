import React from 'react'
import upload from 'url:./icons/upload.svg'

class ImageUploader extends React.Component<any, any> {
  state = {
    uploading: false,
    dragActive: false,
    uploadTotal: 0,
    uploadDone: 0,
  }
  inputRef = React.createRef<HTMLInputElement>()

  onFileSelect(event) {
    this.handleFiles(event.target.files)
  }

  handleFiles(filesList) {
    const files = Array.from(filesList || [])
    if (!files.length) {
      return
    }

    this.setState(
      { uploading: true, uploadTotal: files.length, uploadDone: 0 },
      async () => {
        try {
          if (this.props.onImagesUpload) {
            const onProgress = (done, total = files.length) => {
              this.setState({ uploadDone: done, uploadTotal: total })
            }
            await this.props.onImagesUpload(files, onProgress)
            this.setState({ uploadDone: files.length })
          } else if (this.props.onImageUpload) {
            for (const file of files) {
              await this.props.onImageUpload(file)
              this.setState((prevState) => ({
                uploadDone: prevState.uploadDone + 1,
              }))
            }
          }
        } finally {
          if (this.inputRef.current) {
            this.inputRef.current.value = ''
          }
          this.setState({
            uploading: false,
            dragActive: false,
            uploadTotal: 0,
            uploadDone: 0,
          })
        }
      }
    )
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

    if (this.state.uploading) {
      return
    }

    const { files } = e.dataTransfer
    if (!files || files.length === 0) {
      return
    }

    if (this.props.allowMultiple || this.props.onImagesUpload) {
      this.handleFiles(files)
      return
    }

    this.handleFiles([files[0]])
  }

  render() {
    const uploadLabel = this.props.allowMultiple ? 'Upload Images' : 'Upload Image'
    const dropLabel = this.props.allowMultiple ? 'Drop Images' : 'Drop Image'
    const { uploadDone, uploadTotal, uploading } = this.state
    const uploadingLabel =
      uploadTotal > 1
        ? `Uploading ${uploadDone}/${uploadTotal}`
        : 'Uploading...'
    const buttonClassName = this.props.buttonClassName
      ? `file-drop ${this.props.buttonClassName}`
      : 'file-drop button left-right'
    const showIcon = this.props.showIcon || this.props.iconOnly
    const content = uploading
      ? uploadingLabel
      : this.state.dragActive
      ? dropLabel
      : uploadLabel
    return (
      <form className="upload-form">
        <input
          className="upload-form hidden"
          type="file"
          name="file"
          id="fileUploadInput"
          ref={this.inputRef}
          multiple={this.props.allowMultiple}
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
              buttonClassName +
              (uploading ? ' uploading' : '') +
              ' ' +
              (this.state.dragActive ? ' drag-active' : '') +
              (this.props.noMarginNoBorders ? ' no-margin-no-border' : '')
            }
            onDrop={this.handleDrop.bind(this)}
            onDragOver={this.handleDragOver.bind(this)}
            onDragEnter={this.handleDragEnter.bind(this)}
            onDragLeave={this.handleDragLeave.bind(this)}
          >
            {showIcon && !uploading ? (
              <img src={upload} alt="" />
            ) : (
              content
            )}
          </div>
        </label>
      </form>
    )
  }
}

export default ImageUploader

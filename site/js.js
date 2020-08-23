document.onkeyup = function(e) {
  // Escape should work in text boxes
  if (e.which == 27) {
    hideEntry()
    document.querySelector('.quote-instance').focus()
    return
  }

  // Every other shortcut should not work in text boxes
  if (
    document.activeElement.tagName.toLowerCase() == 'textarea' ||
    document.activeElement.tagName.toLowerCase() == 'input'
  ) {
    return
  }

  if (e.which == 78) {
    showEntry()
    document.getElementById('title-enter').focus()
  }
}

function showEntry() {
  document.querySelector('.quote-entry').style.display = 'block'
}

function hideEntry() {
  document.querySelector('.quote-entry').style.display = 'none'
}

document.addEventListener(
  'input',
  function(event) {
    if (event.target.tagName.toLowerCase() !== 'textarea') return
  },
  false
)

// Stolen from the internet
var autoExpand = function(field) {
  // Reset field height
  field.style.height = 'inherit'

  // Get the computed styles for the element
  var computed = window.getComputedStyle(field)

  // Calculate the height
  var height =
    parseInt(computed.getPropertyValue('border-top-width'), 10) +
    parseInt(computed.getPropertyValue('padding-top'), 10) +
    field.scrollHeight +
    parseInt(computed.getPropertyValue('padding-bottom'), 10) +
    parseInt(computed.getPropertyValue('border-bottom-width'), 10)

  field.style.height = height + 'px'
}

document.addEventListener(
  'input',
  function(event) {
    if (event.target.tagName.toLowerCase() == 'input') {
      //event.target.value = ''; // todo: only when default value, return to default if still null
    } else if (event.target.tagName.toLowerCase() !== 'textarea') {
      return
    }

    autoExpand(event.target)
  },
  false
)

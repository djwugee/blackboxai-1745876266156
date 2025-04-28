var watch = require('mutant/watch')
var Observ = require('mutant/value')

module.exports = InputStack

function InputStack () {
  var keysDown = null
  var stack = []
  var release = null

  function grab () {
    var input = this
    var index = stack.indexOf(input)
    if (!stack.length || index < stack.length - 1) {
      release && release()

      if (stack.length) {
        stack[stack.length - 1].set([])
      }

      if (~index) {
        stack.splice(index, 1)
      }
      stack.push(input)
      release = activate(input)
    }
  }

  function close () {
    var input = this
    var currentTop = stack[stack.length - 1]
    var index = stack.indexOf(input)
    if (~index) {
      stack.splice(index, 1)
    }

    var newTop = stack[stack.length - 1]

    if (newTop !== currentTop) {
      release && release()
      release = activate(newTop)
    }

    input.set([])
  }

  function activate (input) {
    if (input) {
      var releaseInput = watch(getKeysDown(), input.set)
      input.active.set(true)

      return function () {
        releaseInput()
        input.active.set(false)
      }
    }
  }

  function next () {
    if (stack.length > 1) {
      var input = stack.pop()
      release && release()
      input.set([])
      input.active.set(false)

      stack.unshift(input)
      release = activate(stack[stack.length - 1])
    }
  }

  function swap () {
    if (stack.length > 1) {
      var input = stack.pop()
      release && release()
      input.set([])
      input.active.set(false)
      stack.splice(-1, 0, input)
      release = activate(stack[stack.length - 1])
    }
  }

  function getKeysDown () {
    return keysDown = keysDown || KeysDown()
  }

  function handleKey (e) {
    var el = document.activeElement
    if (stack.length) {
      if (!el || (!shouldIgnore(el) && el.contentEditable !== 'true')) {
        if ((e.code === 'Tab' || e.code === 'Enter') && e.type === 'keydown') { // tab or enter
          e.preventDefault()
          next()
        } else if (e.code === 'AltLeft' || e.code === 'AltRight') { // alt
          e.preventDefault()
          swap()
        }
      }
    }
  }

  document.addEventListener('keydown', handleKey, false)
  document.addEventListener('keyup', handleKey, false)

  return function () {
    var input = Observ([])
    input.active = Observ()
    input.grab = grab.bind(input)
    input.close = close.bind(input)
    input.grab()
    return input
  }
}

function shouldIgnore (el) {
  return (el.nodeName === 'INPUT' && el.type !== 'range' && el.type !== 'checkbox') ||
          el.nodeName === 'TEXTAREA'
}

function isModifier (key) {
  return key === 'MetaLeft' || key === 'MetaRight' || key === 'ControlLeft' || key === 'ControlRight'
}

function KeysDown () {
  var obs = Observ([])
  var modifiers = new Set()

  function handleEvent (e) {
    var el = document.activeElement
    if (!el || (!shouldIgnore(el) && el.contentEditable !== 'true')) {
      if (isModifier(e.code)) {
        if (e.type === 'keydown') {
          modifiers.add(e.code)
        } else {
          modifiers.delete(e.code)
        }
      }
      var index = obs().indexOf(e.code)
      if (e.type === 'keydown') {
        if (!~index && modifiers.size === 0) {
          var val = obs().concat()
          val.push(e.code)
          obs.set(val)
          e.preventDefault()
        }
      } else if (e.type === 'keyup') {
        if (~index) {
          var val = obs().concat()
          val.splice(index, 1)
          obs.set(val)
        }
      }
    }
  }

  document.addEventListener('keydown', handleEvent, false)
  document.addEventListener('keyup', handleEvent, false)

  obs.destroy = function () {
    document.removeEventListener('keydown', handleEvent, false)
    document.removeEventListener('keyup', handleEvent, false)
  }

  return obs
}

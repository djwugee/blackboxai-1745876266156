var Param = require('lib/param')
var Property = require('lib/property')
var Sum = require('lib/param-sum')
var Multiply = require('lib/param-multiply')
var Apply = require('lib/apply-param')
var computed = require('mutant/computed')

var Triggerable = require('lib/triggerable')
var ScheduleEvent = require('lib/schedule-event')

module.exports = SampleNode

function SampleNode (context) {
  var output = context.audio.createGain()

  var releases = []
  var obs = Triggerable(context, {
    mode: Property('hold'),
    offset: Property([0, 1]),
    buffer: Param(context),

    startDelay: Param(context, 0),
    amp: Param(context, 1),
    transpose: Param(context, 0),
    tune: Param(context, 0)
  }, trigger, releases)

  obs.context = context

  var detune = Sum([
    toCents(context.noteOffset),
    toCents(obs.transpose),
    obs.tune
  ])

  var lastDetuneValue = 0
  var playbackRate = computed([detune], function (detune) {
    // HACK: handle playback rate to estimate duration - won't work if detune is automated
    if (typeof detune === 'number') {
      lastDetuneValue = detune
    }
    var rate = centsToRate(lastDetuneValue)
    return rate
  })

  var currentBuffer = null
  releases.push(
    obs.buffer.currentValue(v => currentBuffer = v)
  )

  obs.connect = output.connect.bind(output)
  obs.disconnect = output.disconnect.bind(output)

  return obs

  // scoped
  function trigger (at) {
    var mode = obs.mode()

    at = obs.startDelay.getValueAtTime(at) + at

    if (currentBuffer instanceof window.AudioBuffer) {
      var choker = context.audio.createGain()
      var player = context.audio.createBufferSource()
      var amp = context.audio.createGain()
      amp.connect(choker)
      player.connect(amp)
      choker.connect(output)

      player.buffer = currentBuffer
      player.loopStart = currentBuffer.duration * obs.offset()[0]
      player.loopEnd = currentBuffer.duration * obs.offset()[1]

      var releaseAmp = Apply(context.audio, amp.gain, obs.amp, at)

      var event = new ScheduleEvent(at, player, choker, [
        Apply(context.audio, player.detune, detune, at),
        releaseAmp
      ])

      event.onChoke = releaseAmp
      event.maxTo = at + (currentBuffer.duration - player.loopStart) / playbackRate()
      event.to = at + (player.loopEnd - player.loopStart) / playbackRate()

      if (mode === 'loop') {
        player.loop = true
        event.to = null
      }

      if (mode === 'release') {
        event.to = null
        event.stop = function (at) {
          if (at) {
            player.start(at, player.loopStart, (player.loopEnd - player.loopStart) / playbackRate())
          }
        }
      } else {
        player.start(at, player.loopStart)
      }

      if (mode === 'oneshot') {
        event.oneshot = true
      }

      return event
    }
  }
}

function centsToRate (value) {
  return Math.pow(2, value / 1200)
}

function toCents (param) {
  return Multiply([param, 100])
}

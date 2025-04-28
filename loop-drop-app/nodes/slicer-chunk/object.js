var Property = require('lib/property')
var Param = require('lib/param')
var Slots = require('lib/slots')
var Struct = require('mutant/struct')
var BaseChunk = require('lib/base-chunk')
var ExternalRouter = require('lib/external-router')
var lookup = require('mutant/lookup')
var computed = require('mutant/computed')
var detectPeaks = require('lib/detect-peaks')
var gridSlicePeaks = require('lib/grid-slice-peaks')
var watchThrottle = require('mutant/watch-throttle')
var watch = require('mutant/watch')
var extend = require('xtend')
var applyMixerParams = require('lib/apply-mixer-params')
var destroyAll = require('lib/destroy-all')
var onceTrue = require('lib/once-true')

module.exports = SlicerChunk

function SlicerChunk (parentContext) {
  var context = Object.create(parentContext)
  context.output = context.audio.createGain()
  context.output.connect(parentContext.output)

  var overrideParams = applyMixerParams(context)

  var releases = []
  var refreshing = false
  var slots = Slots(context)
  context.slotLookup = lookup(slots, 'id')

  var obs = BaseChunk(context, {
    sample: Sample(context),
    eq: EQ(context),

    sliceMode: Property('divide'),
    stretch: Property(false),
    tempo: Property(100),

    outputs: Property(['output']),
    routes: ExternalRouter(context, {output: '$default'}),
    volume: Property(1)
  }, {
    includedAllTriggers: true
  })

  var resolvedBuffer = obs.sample.buffer.currentValue

  obs.overrideParams = overrideParams
  obs.params = applyMixerParams.params(obs)
  obs.overrideVolume = Property(1)

  var volume = computed([obs.volume, obs.overrideVolume], function (a, b) {
    return a * b
  })

  onceTrue(resolvedBuffer, function () {
    obs.shape(queueRefreshSlices)
    releases.push(resolvedBuffer(queueRefreshSlices))
    obs.sliceMode(queueRefreshSlices)
    obs.sample.mode(queueRefreshSlices)
    watchThrottle(obs.sample.offset, 1000, queueRefreshSlices, {broadcastInitial: false})

    if (!obs.sample.slices()) { // ensure slices have been generated
      queueRefreshSlices()
    }
  })

  var computedSlots = computed([
    obs.sample, obs.stretch, obs.tempo, obs.eq, volume, resolvedBuffer
  ], function (sample, stretch, tempo, eq, volume, buffer) {
    var result = (sample.slices || []).map(function (offset, i) {
      if (stretch && buffer) {
        var originalDuration = getOffsetDuration(buffer.duration, offset)
        var stretchedDuration = tempo / 60 * originalDuration

        return {
          node: 'slot',
          id: String(i),
          output: 'output',
          volume: volume,
          sources: [
            extend(sample, {
              node: 'source/granular',
              mode: 'oneshot',
              attack: 0.1,
              hold: 1,
              release: 0.1,
              duration: stretchedDuration,
              sync: true,
              offset: offset
            })
          ]
        }
      } else {
        return {
          node: 'slot',
          id: String(i),
          output: 'output',
          volume: volume,
          sources: [
            extend(sample, {
              node: 'source/sample',
              mode: 'oneshot',
              offset: offset
            })
          ]
        }
      }
    })

    result.unshift({
      node: 'slot',
      id: 'output',
      processors: [
        extend(eq, {node: 'processor/eq'})
      ]
    })

    return result
  }, {nextTick: true})

  releases.push(
    watch(computedSlots, slots.set),
    slots.onNodeChange(obs.routes.refresh)
  )

  obs.destroy = function () {
    while (releases.length) {
      releases.pop()()
    }
    slots.destroy()
    destroyAll(obs)
  }

  return obs

  // scoped

  function queueRefreshSlices () {
    if (!refreshing) {
      refreshing = true
      setTimeout(refreshSlices, 200)
    }
  }

  function refreshSlices (cb) {
    refreshing = false
    var shape = obs.shape()
    var buffer = resolvedBuffer()
    var sliceMode = obs.sliceMode()
    var triggerMode = obs.sample.mode()
    var offset = obs.sample.offset()
    var count = shape[0] * shape[1]
    var playToEnd = triggerMode === 'full'
    if (sliceMode === 'peak' || sliceMode === 'transient') {
      if (buffer) {
        detectPeaks(buffer.getChannelData(0), count, offset, function (peaks) {
          obs.sample.slices.set(sliceOffsets(peaks, offset, playToEnd))
        })
      }
    } else if (sliceMode === 'snap') {
      if (buffer) {
        gridSlicePeaks(buffer.getChannelData(0), count, offset, function (err, peaks) {
          if (err) throw err
          obs.sample.slices.set(sliceOffsets(peaks, offset, playToEnd))
        })
      }
    } else {
      obs.sample.slices.set(divideSlices(count, offset, playToEnd))
    }
  }
}

function EQ (context) {
  var obs = Struct({
    lowcut: Param(context, 20),
    highcut: Param(context, 20000),
    low: Param(context, 0),
    mid: Param(context, 0),
    high: Param(context, 0)
  })

  obs.destroy = function () {
    destroyAll(obs)
  }

  return obs
}

function Sample (context) {
  var obs = Struct({
    offset: Property([0, 1]),
    amp: Param(context, 1),
    transpose: Param(context, 0),
    buffer: Param(context),
    slices: Property(),
    mode: Property('slice')
  })

  obs.destroy = function () {
    destroyAll(obs)
  }

  obs.context = context
  obs.amp.triggerable = true
  obs.transpose.triggerable = true

  return obs
}

function sliceOffsets (slices, offset, playToEnd) {
  if (playToEnd) {
    return slices.map(function (pos) {
      return [pos, offset[1]]
    })
  } else {
    return slices.map(function (pos, i) {
      return [pos, slices[i + 1] || offset[1]]
    })
  }
}

function divideSlices (length, offset, playToEnd) {
  var step = 1 / length
  var result = []
  for (var i = 0; i < 1; i += step) {
    result.push(subOffset(offset, [i, playToEnd ? 1 : i + step]))
  }
  return result
}

function subOffset (main, sub) {
  var range = main[1] - main[0]
  return [
    main[0] + (sub[0] * range),
    main[0] + (sub[1] * range)
  ]
}

function getOffsetDuration (duration, offset) {
  return (offset[1] * duration) - (offset[0] * duration)
}

function noargs (fn) {
  return function () {
    fn()
  }
}

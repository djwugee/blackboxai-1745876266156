var h = require('lib/h')
var send = require('mutant/send')
var computed = require('mutant/computed')
var when = require('mutant/when')

var AudioMeter = require('lib/widgets/audio-meter')
var Range = require('lib/params/range')
var ToggleButton = require('lib/params/toggle-button')

var audioMeterOptions = {red: 0, amber: -10, min: -40, max: 5, steps: 60}

var renderBrowser = require('./browser')
var renderEditor = require('./tabbed-editor')
var renderControllers = require('./global-controllers')

module.exports = function (project) {
  var context = project.context
  var actions = project.actions

  return h('Holder', [
    h('div.side', [
      h('div.transport', [
        AudioMeter(project.outputRms, audioMeterOptions),
        h('ModParam -value -flex', [
          h('div.param -noDrop', [
            Range(project.tempo, {
              large: true,
              format: 'bpm',
              flex: true,
              defaultValue: 120
            })
          ]),
          h('div.sub', [
            h('div', [
              Range(project.swing, {format: 'offset1', title: 'swing', flex: true}),
              h('button.action -slow', {
                'ev-mousedown': send(setValue, project.speed, 0.95),
                'ev-mouseup': send(setValue, project.speed, 1)
              }, ['<||']),
              h('button.action -tap', {
                'ev-click': send(actions.tapTempo)
              }, ['TAP']),
              h('button.action -fast', {
                'ev-mousedown': send(setValue, project.speed, 1.05),
                'ev-mouseup': send(setValue, project.speed, 1)
              }, ['||>'])
            ])
          ])
        ])
      ]),
      h('div.browser', [

        h('div -setups', [
          h('header', [
            h('span', 'Setups'),
            when(project.selected,
              when(project.duplicating,
                h('button.new', {'disabled': true}, 'Duplicating...'),
                h('button.new', {'ev-click': send(actions.duplicateCurrent)}, 'Duplicate')
              )
            ),
            h('button.new', {'ev-click': send(actions.newSetup)}, '+ New')
          ]),
          renderBrowser(project.entries, project)
        ]),

        h('div -recordings', [
          h('header', [
            h('span', 'Recordings'),
            h('span', {
              style: {
                'margin-right': '5px',
                'font-weight': 'bold',
                'color': '#AAA',
                'text-align': 'right',
                'font-family': 'monospace',
                'margin-top': '2px'
              }
            }, [
              computed([project.recordPosition], formatRecordingPosition)
            ]),
            ToggleButton(project.recording, {
              classList: ['record'],
              title: 'Record',
              description: 'Record output audio to project folder'
            })
          ]),
          renderBrowser(project.recordingEntries, project)
        ])
      ]),
      renderControllers(project.globalControllers)
    ]),
    h('div.main', [
      renderEditor(project)
    ])
  ])
}

function setValue (target) {
  target.set(this.opts)
}

function formatRecordingPosition (value) {
  if (value != null) {
    return formatTime(value)
  }
}

function formatTime (value) {
  var minutes = Math.floor(value / 60)
  var seconds = Math.floor(value % 60)
  return minutes + ':' + ('0' + seconds).slice(-2)
}

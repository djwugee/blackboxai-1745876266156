var h = require('lib/h')
var renderRouting = require('lib/widgets/routing')
var renderChunk = require('lib/widgets/chunk')
var renderParams = require('lib/widgets/params')
var ToggleButton = require('lib/params/toggle-button')
var FlagParam = require('lib/flag-param')

module.exports = function (external) {
  return renderChunk(external, {
    external: true,
    extraHeader: h('span.type', ['meddler']),
    main: [
      h('section', [
        renderParams(external),
        h('ParamList', [
          h('div -block', [
            h('div.extTitle', 'Use Global'),
            h('ParamList -compact', [
              ToggleButton(FlagParam(external.flags, 'noRepeat'), {
                title: 'Repeat',
                onValue: false,
                offValue: true
              })
            ])
          ]),
          renderRouting(external)
        ])
      ])
    ]
  })
}

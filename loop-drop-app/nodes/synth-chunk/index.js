var randomColor = require('lib/random-color')

module.exports = {
  name: 'Synth',
  node: 'chunk/synth',
  description: 'Basic subtractive synthesier using global scale specified.',
  group: 'simpleChunks',
  spawn: function () {
    return {
      color: randomColor(),
      osc1: {
        shape: 'sawtooth',
        amp: 0.4
      },
      amp: {
        node: 'modulator/adsr',
        value: 1,
        attack: 0.1,
        release: 0.5
      },
      filter: {
        type: "lowpass",
        frequency: 5400,
        Q: 1
      }
    }
  },
  object: require('./object'),
  render: require('./view')
}

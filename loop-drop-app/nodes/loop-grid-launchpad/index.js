module.exports = {
  name: 'Launchpad Mini',
  group: 'loop-grids',
  portMatch: /^Launchpad(?! (Pro|MK2))/,
  node: 'controller/launchpad',
  render: require('../loop-grid/view'),
  object: require('./object')
}

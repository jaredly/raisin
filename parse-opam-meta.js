const path = require('path')
const fs = require('fs')
const {sh} = require('./utils')
const capitalize = x => x[0].toUpperCase() + x.slice(1)

module.exports = (base, name) => {
  if (!fs.existsSync(path.join(base, 'META'))) {
    return null
  }

  const lines = fs.readFileSync(path.join(base, 'META'))
    .toString('utf8')
    .split(/\n/g)
    .map(x => x.trim())
    .filter(x => x)

  let current = null
  let inBlock = false
  const metas = {
    base: {
      name: name && name.split('.')[0],
      type: 'opam', requires: []
    },
    subs: {},
  }
  lines.forEach(line => {
    line = line.trim()
    // TODO maybe care about the blocks?
    if (inBlock) {
      if (line === ')') {
        inBlock = false
        return
      }
    }
    if (line.match(/\($/g)) {
      if (inBlock) throw new Error(`Can't handle the nesting`)
      inBlock = true
      let [_, blockName] = line.match(/package "([^"]+)"/)
      blockName = metas.base.name + '.' + blockName
      metas.subs[blockName] = {name: blockName, type: 'opam', requires: []}
      current = blockName
      return
    }
    if (!line) {
      return
    }

    const match = line.match(/^(\S+)\s*=\s*"([^"]*)"\s*$/)
    if (!match) {
      // console.warn('Unknown META line', line)
      return
    }
    let [_, attr, value] = match
    if (attr.match(/^archive/)) {
      value = path.join(base, value)
    }
    if (attr === 'requires') {
      value = value.split(/[\s,]+/g)
    }
    const meta = inBlock ? metas.subs[current] : metas.base
    meta[attr] = value
    if (attr === 'archive(byte)') {
      meta['archive(interface)'] = value.replace(/\.cm[oa]$/, '.cmi')
    }
  })
  return metas
}


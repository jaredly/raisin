const path = require('path')
const fs = require('fs')
const {sh} = require('./utils')
const capitalize = x => x[0].toUpperCase() + x.slice(1)

module.exports = base => {
  const text = fs.readFileSync(path.join(base, 'META')).toString('utf8')
  const meta = {}
  let inBlock = false
  text.split(/\n/g).forEach(line => {
    line = line.trim()
    // TODO maybe care about the blocks?
    if (inBlock) {
      if (line === ')') {
        inBlock = false
      }
      return
    }
    if (line.match(/\($/g)) {
      inBlock = true
      return
    }
    if (!line) {
      return
    }

    const match = line.match(/^(\S+)\s*=\s*"([^"]+)"\s*$/)
    if (!match) {
      console.warn('Unknown META line', line)
      return
    }
    let [_, attr, value] = match
    if (attr.match(/^archive/)) {
      value = path.join(base, value)
    }
    meta[attr] = value
  })
  meta['archive(interface)'] = meta['archive(byte)'].replace(/\.cmo$/, '.cmi')
  meta.requires = meta.requires ? meta.requires.split(',') : []
  // console.log('meta', meta)
  return meta
}


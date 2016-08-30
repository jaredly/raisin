
const fs = require('fs')

module.exports = (file, importPrefix) => {
  const text = fs.readFileSync(file).toString('utf8')
  // console.log('parsing', text)
  const deps = []
  text.replace(/\[%%import \((\w+)\) from ([\w\.]+)\]/g, (_, target, source) => {
    const parts = source.split(/\./g)
    if (parts[0] === 'Self') {
      deps.push({
        isSelf: true,
        name: 'Self' + importPrefix + '__' + (parts.length === 1 ? target : parts[1])
      })
    } else {
      deps.push({
        name: parts[0],
        full: parts.concat([target]),
      })
    }
  })

  text.replace(/\[%%import \{\w+\} from ([\w\.]+)\]/g, (_, source) => {
    const parts = source.split(/\./g)
    if (parts[0] === 'Self') {
      deps.push({
        isSelf: true,
        name: parts[0] + importPrefix + '__' + parts[1],
      })
    } else {
      deps.push({
        name: parts[0],
        full: parts,
      })
    }
  })
  // console.log('DEPS', file, deps)
  return deps
}


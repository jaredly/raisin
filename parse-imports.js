
const fs = require('fs')

module.exports = (file, importPrefix) => {
  const text = fs.readFileSync(file).toString('utf8')
  // console.log('parsing', text)
  const deps = []
  const found = {}
  text.replace(/\[%%import \((\w+)\) from ([\w\.]+)\]/g, (_, target, source) => {
    const parts = source.split(/\./g)
    if (parts[0] === 'Self') {
      const name = 'Self' + importPrefix + '__' + (parts.length === 1 ? target : parts[1])
      if (!found[name]) {
        found[name] = true
        deps.push({
          isSelf: true,
          name: name
        })
      }
    } else {
      if (!found[parts[0]]) {
        found[parts[0]] = true
        deps.push({
          name: parts[0],
          full: parts.concat([target]),
        })
      }
    }
  })

  text.replace(/\[%%import \{[^\}]+\} from ([\w\.]+)\]/g, (_, source) => {
    const parts = source.split(/\./g)
    if (parts[0] === 'Self') {
      const name = parts[0] + importPrefix + '__' + parts[1]
      if (!found[name]) {
        found[name] = true
        deps.push({
          isSelf: true,
          name: name
        })
      }
    } else {
      if (!found[parts[0]]) {
        found[parts[0]] = true
        deps.push({
          name: parts[0],
          full: parts,
        })
      }
    }
  })
  // console.log('DEPS', file, deps)
  return deps
}


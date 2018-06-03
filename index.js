class Patchlogs {
  constructor () {
    this.posts = require('./data/patchlogs.json')
  }

  /**
   * Retrieve patch logs specific to a certain item. Still very much Beta,
   * probably always will be, but I'm trying \o/
   */
  getItemChanges (item) {
    const logs = []
    const target = Object.assign({}, item) // Don't mutate the original item
    let abilities = /[\s\S]+/g

    // If item is a Prime Warframe/Sentinel, we should include patchlogs of
    // normal variants too, as they share the same abilities.
    if (target.type === 'Warframe' && target.name.includes('Prime')) {
      target.name = target.name.replace(' Prime', '')
    }

    // Generate regex for matching ability names
    if (target.abilities) {
      let regex = '('

      for (let ability of target.abilities) {
        regex += `${ability.name}|`
      }
      regex += ')'
      abilities = new RegExp(regex)
    }

    for (let post of this.posts) {
      const log = {
        name: post.name,
        date: post.date,
        url: post.url,
        additions: '',
        changes: '',
        fixes: ''
      }

      // Parse changes, fixes, additions
      for (let key of ['changes', 'fixes', 'additions']) {
        const lines = post[key].split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]

          if (line.includes(target.name) || line.match(abilities)) {
            let changes = []

            // Changes are in multiple lines (until next line with `:`)
            if (line.endsWith(':')) {
              changes.push(line)

              for (let j = i + 1; j < lines.length; j++) {
                const subline = lines[i]
                if (subline.endsWith(':')) {
                  i += j - 1
                  break
                } else {
                  changes.push(subline)
                }
              }
            }

            // Changes are in one line
            else {
              changes.push(line)
            }
            log[key] += log[key] ? '\n' + changes.join('\n') : changes.join('\n')
          }
        }
      }

      if (log.changes || log.fixes || log.additions) {
        logs.push(log)
      }
    }
    return logs.sort((a, b) => {
      const d1 = new Date(a.date)
      const d2 = new Date(b.date)
      return d2 - d1
    })
  }
}

module.exports = new Patchlogs()

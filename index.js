class Patchlogs {
  constructor () {
    this.posts = require('./data/patchlogs.json')
  }

  /**
   * Retrieve patch logs specific to a certain item. Still very much Beta,
   * probably always will be, but I'm trying \o/
   */
  getItemChanges (item) {
    const keys = ['changes', 'fixes', 'additions']
    const logs = []
    const target = Object.assign({}, item) // Don't mutate the original item

    // If item is a Prime Warframe/Sentinel, we should include patchlogs of
    // normal variants too, as they share the same abilities.
    if (target.type === 'Warframe' && target.name.includes('Prime')) {
      target.name = target.name.replace(' Prime', '')
    }

    for (let post of this.posts) {
      const log = {
        name: post.name,
        date: post.date,
        url: post.url
      }

      // Parse changes, fixes, additions
      for (let key of keys) {
        const lines = post[key].split('\n')

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i]

          if (line.includes(target.name)) {
            let changes = ''

            // Changes are in multiple lines (until next line with `:`)
            if (line.endsWith(':')) {
              changes += line + '\n'

              for (let j = i + 1; j < lines.length; j++) {
                const subline = lines[i]
                if (subline.endsWith(':')) {
                  i += j - 1
                  break
                } else {
                  changes += subline + '\n'
                }
              }
            }

            // Changes are in one line
            else {
              changes += line
            }
            log[key] = changes
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

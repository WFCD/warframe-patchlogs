const keys = ['changes', 'fixes', 'additions'];

/**
 * @typedef {Object} RawPatchData
 * @property {string} name
 * @property {string} date
 * @property {string} imgUrl
 * @property {string} url
 */

/**
 * @typedef {Object} PatchData
 * @property {string} name
 * @property {string} date
 * @property {string} imgUrl
 * @property {string} url
 * @property {string} additions
 * @property {string} fixes
 * @property {string} changes
 */

/**
 * @typedef {Object} PatchOptions
 * @property {string} name item name to search for
 * @property {string} type item type to match
 * @property {Array<Ability>} abilities item abilities
 */

/**
 * @typedef {Object} Ability
 * @property {string} name
 */

class Patchlogs {
  constructor() {
    this.posts = require('./data/patchlogs.json');
  }

  /**
   * Retrieve patch logs specific to a certain item. Still very much Beta,
   * probably always will be, but I'm trying \o/
   * @param {PatchOptions} item item to pull changes from
   * @return {Array<PatchData>}
   */
  getItemChanges(item) {
    const logs = [];
    const target = { ...item }; // Don't mutate the original item

    // If item is a Prime Warframe/Sentinel, we should include patchlogs of
    // normal variants too, as they share the same abilities.
    if (target.type === 'Warframe' && target.name.includes('Prime')) {
      target.name = target.name.replace(' Prime', '');
    }

    this.posts.forEach((post) => {
      /** @type {PatchData} */
      const log = {
        name: post.name,
        date: post.date,
        url: post.url,
        imgUrl: post.imgUrl,
        additions: '',
        changes: '',
        fixes: '',
      };

      // Parse changes, fixes, additions
      keys.forEach((key) => {
        const lines = post[key].split('\n');
        lines.forEach((line, i) => {
          let includesAbility = false;

          // Loop through abilities to see if line contains that name. Could be
          // solved easier with some regex, but that causes some memory leak
          // that I'm unable to understand.
          target && target.abilities && target.abilities.forEach((ability) => {
            includesAbility = line.includes(ability.name) ? true : includesAbility;
          });

          if (line.includes(target.name) || includesAbility) {
            const changes = [];

            changes.push(line);
            // Changes are in multiple lines (until next line with `:`)
            if (line.endsWith(':')) {
              for (let j = i + 1; j < lines.length; j += 1) {
                const subline = lines[i];
                if (subline.endsWith(':')) {
                  // eslint-disable-next-line no-param-reassign
                  i += j - 1;
                  break;
                } else {
                  changes.push(subline);
                }
              }
            }
            log[key] += log[key] ? `\n${changes.join('\n')}` : changes.join('\n');
          }
        });
      });

      if (log.changes || log.fixes || log.additions) {
        logs.push(log);
      }
    });

    return logs.sort((a, b) => {
      const d1 = new Date(a.date);
      const d2 = new Date(b.date);
      return d2 - d1;
    });
  }
}

module.exports = new Patchlogs();

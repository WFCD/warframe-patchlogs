const request = require('cloudscraper-promise')
const cheerio = require('cheerio')
const baseUrl = 'https://forums.warframe.com/forum/3-pc-update-build-notes/'
const title = (str) => str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase())
const sleep = (s) => new Promise(resolve => setTimeout(resolve, s))

/**
 * Scraper to get patch logs from forums. This is gonna be too complex to keep
 * in the main scraper.
 */
class Patchlogs {
  constructor (options = {}) {
    this.init(options)
    this.setup = new Promise(resolve => { this.resolve = resolve })
    this.posts = []
  }

  async init (options) {
    const pages = options.pages || await this.getPageNumbers()
    for (let i = 1; i <= pages; i++) {
      await sleep(5000)
      await this.scrape(`${baseUrl}?page=${i}`)
    }
    this.resolve()
  }

  /**
   * Retrieve number of post pages to look through. This value should be set to
   * 1 through the constructor if we only need the most recent changes.
   */
  async getPageNumbers () {
    const html = (await request.get(baseUrl)).body.toString('utf-8')
    const $ = cheerio.load(html)
    const text = $('a[id^="elPagination"]').text().trim().split(' ')

    if (text.length < 2) {
      throw new Error('Connection blocked by Cloudflare.')
    }
    return parseInt(text[text.length - 1])
  }

  /**
   * Scrape single page of posts
   */
  async scrape (url) {
    const html = (await request.get(url)).body.toString('utf-8')
    const $ = cheerio.load(html)

    $('ol[id^="elTable"] li').each(async (i, el) => {
      const post = {
        name: $(el).find('h4 a span').text().trim().replace(/(\t|\n)/g, '').replace(/\[(.*?)\]/g, ''),
        url: $(el).find('h4 a').attr('href'),
        date: $(el).find('time').attr('datetime'),
        additions: '',
        changes: '',
        fixes: ''
      }

      if (post.url) {
        await sleep(5000)
        await this.scrapePost(post.url, post)
        this.posts.push(post)
      }
    })
  }

  /**
   * Retrieve logs from a single post.
   * Looks for changes, additions and fixes
   */
  async scrapePost (url, data) {
    const html = (await request.get(url)).body.toString('utf-8')
    const $ = cheerio.load(html)
    const post = $('article').first().find('div[data-role="commentContent"]')
    let previousCategory = 'Fixes'

    $(post).children().each((i, el) => {
      const strong = title($(el).find('strong').text().trim())
      const em = $(el).find('em').text().trim()
      const ul = $(el).is('ul')

      if (i === 1 && em) {
        data.description = em
      }
      else if (i && strong && (strong === 'Fixes' || strong === 'Changes' || strong === 'Additions')) {
        data[strong.toLowerCase()] = ''
        previousCategory = strong.toLowerCase()
      }
      else if (strong && !strong.includes('Edited ') && !strong.includes(' by ')) {
        if (strong.includes('Fix')) {
          data.fixes += strong + (strong.endsWith(':') ? '\n' : ':\n')
          previousCategory = 'fixes'
        } else {
          data.changes += strong + (strong.endsWith(':') ? '\n' : ':\n')
          previousCategory = 'changes'
        }

      }
      else if (ul) {
        // The regex gets rid of tabs, multi newlines and newlines at start/end
        data[previousCategory] = $(el).text().replace(/\t/g, '').replace(/\n\s*\n/g, '\n').replace(/^\s+|\s+$/g, '')
      }
    })
    data.type = data.name.includes('Hotfix') ? 'Hotfix' : 'Update'
  }

  /**
   * Retrieve patch logs specific to a certain item. Still very much Beta,
   * probably always will be, but I'm trying \o/
   */
  async getItemChanges (item) {
    const keys = ['changes', 'fixes', 'additions']
    const logs = []
    const target = Object.assign({}, item) // Don't mutate the original item
    await this.setup

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
      const d1 = new Date(a.date) * 1
      const d2 = new Date(b.date) * 1
      return d2 - d1
    })
  }
}

module.exports = Patchlogs

const request = require('requestretry').defaults({ fullResponse: false })
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
      await sleep(2500)
      await this.scrape(`${baseUrl}?page=${i}`)
    }
    this.resolve()
  }

  /**
   * Retrieve number of post pages to look through. This value should be set to
   * 1 through the constructor if we only need the most recent changes.
   */
  async getPageNumbers () {
    const html = await request(baseUrl)
    const $ = cheerio.load(html)
    const text = $('a[id^="elPagination"]').text().trim().split(' ')
    return parseInt(text[text.length - 1])
  }

  /**
   * Scrape single page of posts
   */
  async scrape (url) {
    const html = await request(url)
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
        await sleep(2500)
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
    const html = await request(url)
    const $ = cheerio.load(html)
    const post = $('article').first().find('div[data-role="commentContent"]')
    let previousCategory = 'Fixes'

    $(post).children().each((i, el) => {
      const strong = title($(el).find('strong').text())
      const em = $(el).find('em').text()
      const ul = $(el).is('ul')

      if (i === 1 && em) {
        data.description = em
      }
      else if (i && strong && (strong === 'Fixes' || strong === 'Changes' || strong === 'Additions')) {
        data[strong.toLowerCase()] = ''
        previousCategory = strong.toLowerCase()
      }
      else if (strong) {
        data.changes += strong + (strong.endsWith(':') ? '\n' : ':\n')
        previousCategory = 'changes'
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
    await this.setup

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

          if (line.toLowerCase().includes(item.toLowerCase())) {
            let changes = ''

            // Changes are in multiple lines (until next line with `:`)
            if (line.endsWith(':')) {
              changes += line + '\n'

              for (i += 1; i < lines.length; i++) {
                const subline = lines[i]
                if (subline.endsWith(':')) {
                  i--
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
    return logs
  }
}

module.exports = Patchlogs

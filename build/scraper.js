const request = require('cloudscraper-promise')
const cheerio = require('cheerio')
const cache = require('../data/patchlogs.json')
const baseUrl = 'https://forums.warframe.com/forum/3-pc-update-build-notes/'
const sleep = (s) => new Promise(resolve => setTimeout(resolve, s))
const title = (str) => str.toLowerCase().replace(/\b\w/g, l => l.toUpperCase())

/**
 * Scraper to get patch logs from forums.
 */
class Scraper {
  constructor () {
    this.setup = new Promise(resolve => { this.resolve = resolve })
    this.posts = []
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
    const selector = $('ol[id^="elTable"] .ipsDataItem')

    // Loop through found elements. Stupid jquery doesn't support async inside
    // each loop.
    for (const key in selector) {
      if (key.match(/^\d+$/)) {
        const el = $(selector[key])
        const post = {
          name: $(el).find('h4 a span').text().trim().replace(/(\t|\n)/g, '').replace(/\[(.*?)\]/g, ''),
          url: $(el).find('h4 a').attr('href'),
          date: $(el).find('time').attr('datetime'),
          imgUrl: '',
          additions: '',
          changes: '',
          fixes: ''
        }

        if (post.url) {
          const cached = cache.find(p => p.name === post.name)

          if (cached) {
            console.log(`Already scraped: ${post.name}`)
            this.posts.push(cached)
          } else {
            console.log(`Scraping: ${post.name}`)
            await sleep(1000)
            await this.scrapePost(post.url, post)
            this.posts.push(post)
          }
        }
      }
    }
  }

  /**
   * Retrieve logs from a single post.
   */
  async scrapePost (url, data) {
    const html = (await request.get(url)).body.toString('utf-8')
    const $ = cheerio.load(html)
    const post = $('article').first().find('div[data-role="commentContent"]')
    data.imgUrl = $('article').first().find('img.ipsImage').first().attr('data-imageproxy-source')
    let previousCategory = 'fixes'

    /**
     * Add changes, fixes, additions
     */
    $(post).children().each((i, el) => {
      const strong = title($(el).find('strong').text().trim()).replace(/- /g, '\n')
      const em = $(el).find('em').text().trim().replace(/- /g, '\n')

      // Description
      if (i === 1 && em) {
        data.description = em
      }

      // Detect category
      else if (i && strong) {
        ['Fixes', 'Additions', 'Changes'].forEach(type => {
          if (strong.includes(type)) {
            previousCategory = type.toLowerCase()
          }
        })
      }

      // Fixes or changes
      else if (strong && !strong.includes('Edited ') && !strong.includes(' by ')) {
        if (strong.includes('Fix')) {
          data.fixes += strong + (strong.endsWith(':') ? '\n' : ':\n')
          previousCategory = 'fixes'
        } else {
          data.changes += strong + (strong.endsWith(':') ? '\n' : ':\n')
          previousCategory = 'changes'
        }
      }

      // Add to last category if none could be found
      else {
        // Regex removes tabs and more than one newline in a row.
        const text = $(el).text().trim().replace(/\t/g, '').replace(/[\n]+/g, '\n').replace(/- /g, '\n')
        data[previousCategory] += text + '\n'
      }
    })
    data.type = data.name.includes('Hotfix') ? 'Hotfix' : 'Update'
  }
}

module.exports = new Scraper()

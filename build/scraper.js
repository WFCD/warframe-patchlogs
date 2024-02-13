import cheerio from 'cheerio';

import cache from '../data/patchlogs.json' assert { type: 'json' };

import sleep from './sleep.js';
import title from './title.js';

const baseUrl = 'https://forums.warframe.com/forum/3-pc-update-notes/';

/**
 * Scraper to get patch logs from forums.
 * @property {Array<{PatchData}>} posts
 */
class Scraper {
  constructor() {
    this.setup = new Promise((resolve) => {
      this.resolve = resolve;
    });
    this.posts = [];
  }

  async #fetch() {
    return (await fetch(baseUrl)).text();
  }

  /**
   * Retrieve number of post pages to look through. This value should be set to
   * 1 through the constructor if we only need the most recent changes.
   * @returns {Promise<number>} total number of pages
   */
  async getPageNumbers() {
    const html = await this.#fetch();
    const $ = cheerio.load(html);
    const text = $('a[id^="elPagination"]').text().trim().split(' ');

    if (text.length < 2) {
      throw new Error('Connection blocked by Cloudflare.');
    }
    return parseInt(text[text.length - 1], 10);
  }

  /**
   * Scrape single page of posts
   * @param {string} url to fetch content from
   * @param {ProgressBar} bar progress bar to visually track progress
   * @returns {void}
   */
  async scrape(url, bar) {
    const html = await this.#fetch();
    const $ = cheerio.load(html);
    const selector = $('ol[id^="elTable"] .ipsDataItem');

    // Loop through found elements. Stupid jquery doesn't support async inside
    // each loop.
    // eslint-disable-next-line no-restricted-syntax
    for (const key in selector) {
      if (key.match(/^\d+$/)) {
        const el = $(selector[key]);
        /** @type {PatchData} */
        const post = {
          name: $(el)
            .find('h4 a span')
            .text()
            .trim()
            .replace(/[\t\n]/g, '')
            .replace(/\[(.*?)]/g, ''),
          url: $(el).find('h4 a').attr('href'),
          date: $(el).find('time').attr('datetime'),
          imgUrl: '',
          additions: '',
          changes: '',
          fixes: '',
        };

        if (post.url) {
          const cached = cache.find((p) => p.name === post.name);

          if (cached) {
            this.posts.push(cached);
          } else {
            await sleep(1000);
            await this.scrapePost(post.url, post);
            bar.tick({ status: 'Scraped', post: undefined });
            this.posts.push(post);
          }
        }
      }
    }
  }

  /**
   * Retrieve logs from a single post.
   * @param {string} url url to fetch
   * @param {Object} data post data
   * @returns {void}
   */
  async scrapePost(url, data) {
    const html = await this.#fetch();
    const $ = cheerio.load(html);
    const article = $('article').first();
    const post = article.find('div[data-role="commentContent"]');
    data.imgUrl = article.first().find('img.ipsImage').first().attr('data-imageproxy-source');
    let previousCategory = 'fixes';

    /**
     * Add changes, fixes, additions
     */
    $(post)
      .children()
      .each((i, el) => {
        const strong = title($(el).find('strong').text().trim()).replace(/- /g, '\n');
        const em = $(el).find('em').text().trim().replace(/- /g, '\n');

        // Description
        if (i === 1 && em) {
          data.description = em;
        }

        // Detect category
        else if (i && strong) {
          ['Fixes', 'Additions', 'Changes'].forEach((type) => {
            if (strong.includes(type)) {
              previousCategory = type.toLowerCase();
            }
          });
        }

        // Fixes or changes
        else if (strong && !strong.includes('Edited ') && !strong.includes(' by ')) {
          if (strong.includes('Fix')) {
            data.fixes += strong + (strong.endsWith(':') ? '\n' : ':\n');
            previousCategory = 'fixes';
          } else {
            data.changes += strong + (strong.endsWith(':') ? '\n' : ':\n');
            previousCategory = 'changes';
          }
        } else {
          // Add to last category if none could be found
          // Regex removes tabs and more than one newline in a row.
          const text = $(el).text().trim().replace(/\t/g, '').replace(/[\n]+/g, '\n').replace(/- /g, '\n');
          data[previousCategory] += `${text}\n`;
        }
      });
    data.type = data.name.includes('Hotfix') ? 'Hotfix' : 'Update';
  }
}

export default new Scraper();

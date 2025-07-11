import { load } from 'cheerio';

import cache from '../data/patchlogs.json' with { type: 'json' };

import ProgressBar from './progress.js';
import sleep from './sleep.js';
import title from './title.js';

const baseUrl = 'https://forums.warframe.com/forum/3-pc-update-notes/';
const proxyUrl = process.env.PROXY_URL;
const isCI = process.env.CI === 'true';
const ciTimeout = process.env.CI_TIMEOUT ? parseInt(process.env.CI_TIMEOUT, 10) : 60000;
const localTimeout = process.env.LOCAL_TIMEOUT ? parseInt(process.env.LOCAL_TIMEOUT, 10) : 12000000;

if (!proxyUrl) {
  console.error('PROXY_URL environment variable is not set.');
  process.exit(1);
}

/**
 * Scraper to get patch logs from forums.
 * @property {Array<{PatchData}>} posts
 */
class Scraper {
  #pagesBar;
  #numPages;
  #postsBar;
  #numPosts = 0;
  #numCached = 0;
  #numUncached = 0;

  /**
   * Array of fetched pages' posts to parse
   * @type {Array<Array<PatchData>>}
   */
  #fetchedPages = [];

  constructor() {
    this.setup = new Promise((resolve) => {
      this.resolve = resolve;
    });
    this.posts = [];
  }

  interrupt() {
    console.error('No pages found');
    process.exit(1);
  }

  async #fetch(url = baseUrl, session = 'fetch-warframe') {
    try {
      const res = await fetch(`${proxyUrl}/v1`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cmd: 'request.get',
          url,
          session,
          maxTimeout: isCI ? ciTimeout : localTimeout,
          returnOnlyCookies: false,
          returnPageContent: true,
        }),
      });
      const { solution } = await res.json();
      if (!solution?.response) {
        throw solution;
      }
      return solution.response;
    } catch (error) {
      console.error(`Failed to fetch from proxy ${url}:`, error);
      throw error;
    }
  }

  /**
   * Retrieve number of post pages to look through. This value should be set to
   * 1 through the constructor if we only need the most recent changes.
   * @returns {Promise<number>} set the total number of pages
   */
  async getPageNumbers() {
    const html = await this.#fetch(undefined, 'get-page-numbers');
    const $ = load(html);
    const text = $('a[id^="elPagination"]').text().trim().split(' ');

    if (text.length < 2) {
      throw new Error('Connection blocked by Cloudflare.');
    }
    this.#numPages = parseInt(text[text.length - 1], 10);
    this.#pagesBar = new ProgressBar('Scraping Page', this.#numPages);
    return this.#numPages;
  }

  /**
   * Scrape single page of posts
   * @param {string} url to fetch content from
   * @returns {void}
   */
  async scrape(url) {
    const html = await this.#fetch(url);
    const $ = load(html);
    const selector = $('ol[id^="elTable"] .ipsDataItem');
    const page /** @type {PatchData[]} */ = [];
    let isCached = false;

    // Loop through found elements.
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
        if (cache.find((p) => p.name === post.name)) {
          isCached = true;
        }
        page.push(post);
        this.#numPosts += 1;
      }
    }
    this.#fetchedPages.push(page);
    this.#pagesBar.tick();
    if (isCached) {
      await Promise.all(
        new Array(this.#numPages).fill(0).map(async (i, idx) => {
          if (idx < this.#numPages - 1) {
            this.#pagesBar.tick();
            await sleep(10);
          }
        })
      );
    }

    return isCached;
  }

  // after scraping the last of the above pages, we can start parsing posts...
  // need to find a way to return above and not re-scrape old pages
  async parsePosts(afterEachPage) {
    this.#postsBar = new ProgressBar('Parsing Posts', this.#numPosts, true);
    // eslint-disable-next-line no-restricted-syntax
    for await (const posts of this.#fetchedPages) {
      const index = this.#fetchedPages.indexOf(posts);
      await this.#parsePage(posts);
      if (afterEachPage) {
        await afterEachPage(this.posts);
      }
      if (index !== this.#fetchedPages.length - 1) {
        await sleep(1000);
      }
    }
  }

  async #parsePage(posts /** @type {Array<PatchData>} */) {
    // preserve prior cached posts, don't wait for them to be discovered again
    this.posts.push(...cache);

    // eslint-disable-next-line no-restricted-syntax
    for await (const post of posts) {
      if (post.url) {
        const cached = cache.find((p) => p.name === post.name);

        if (cached) {
          this.#numCached += 1;
        } else {
          await sleep(100);
          await this.#scrapePost(post.url, post);
          this.posts.push(post);
          this.#numUncached += 1;
        }
        this.#postsBar.tick({ cached: this.#numCached, uncached: this.#numUncached });
      }
    }
  }

  /**
   * Retrieve logs from a single post.
   * @param {string} url url to fetch
   * @param {PatchData} data post data
   * @returns {void}
   */
  async #scrapePost(url, data) {
    const html = await this.#fetch(url);
    const $ = load(html);
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

import { load } from 'cheerio';

import cache from '../data/patchlogs.json' with { type: 'json' };

import ProgressBar from './progress.js';
import title from './title.js';

/** Forum HTML is Cloudflare-blocked; RSS feed is reachable (e.g. via WARP in CI). */
const feedUrl = 'https://forums.warframe.com/forum/3-pc-update-notes.xml';

const fetchHeaders = {
  'user-agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
  accept: 'application/rss+xml, application/xml, text/xml, */*',
};

/**
 * Scraper to get patch logs from the PC Update Notes RSS feed.
 * @property {Array<{PatchData}>} posts
 */
class Scraper {
  #postsBar;
  #numCached = 0;
  #numUncached = 0;
  #numImgBackfills = 0;

  constructor() {
    this.posts = [];
  }

  get hasNewPosts() {
    return this.#numUncached > 0 || this.#numImgBackfills > 0;
  }

  interrupt() {
    console.error('No posts found in feed');
    process.exit(1);
  }

  /**
   * Prefer full-size CDN URL over Invision thumbnail paths.
   * @param {string} url raw image URL
   * @returns {string} normalized URL
   */
  #normalizeImgUrl(url) {
    if (!url) return '';
    // https://www-static.warframe.com/uploads/thumbnails/<hash>_1600x900.png
    // → https://www-static.warframe.com/uploads/<hash>.png
    return url.replace(/\/uploads\/thumbnails\/([a-f0-9]+)_\d+x\d+(\.[a-z]+)$/i, '/uploads/$1$2');
  }

  /**
   * Pick hero image from RSS description HTML.
   * @param {Object} $ cheerio API for the description fragment
   * @returns {string} best image URL or empty
   */
  #pickImgUrl($) {
    const candidates = [];
    $('img').each((_, el) => {
      const node = $(el);
      const raw = node.attr('data-imageproxy-source') || node.attr('data-src') || node.attr('src') || '';
      const src = this.#normalizeImgUrl(raw.trim());
      if (!src || !/^https?:\/\//i.test(src)) return;
      // Skip smilies / tiny UI chrome
      if (/smiley|emoji|emoticon|spacer|pixel/i.test(src)) return;

      let score = 0;
      if (/warframe\.com\/uploads/i.test(src)) score += 50;
      if (/imgur\.com/i.test(src)) score += 40;
      if (node.hasClass('ipsImage')) score += 20;
      if (!/\/thumbnails\//i.test(raw)) score += 10;
      if (/\.(png|jpe?g|webp)(\?|$)/i.test(src)) score += 5;
      candidates.push({ src, score });
    });

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.src || '';
  }

  /**
   * @param {string} url feed or resource URL
   * @returns {Promise<string>} response body
   */
  async #fetch(url) {
    const res = await fetch(url, { headers: fetchHeaders });
    if (!res.ok) {
      throw new Error(`Fetch failed ${res.status} for ${url}`);
    }
    return res.text();
  }

  // eslint-disable-next-line valid-jsdoc -- optional callback; valid-jsdoc chokes on union/optional forms
  /**
   * Fetch RSS feed and parse new (uncached) posts from item descriptions.
   * Historical posts stay in committed `data/patchlogs.json`; feed only carries ~25 latest.
   * @returns {Promise<number>} number of feed items seen
   */
  async scrapeFeed(afterEach) {
    const xml = await this.#fetch(feedUrl);
    const $ = load(xml, { xmlMode: true });
    const items = $('item').toArray();

    if (!items.length) {
      throw new Error('No items found in RSS feed. Check WARP / network egress.');
    }

    this.posts.push(...cache);
    this.#postsBar = new ProgressBar('Parsing Posts', items.length, true);

    // eslint-disable-next-line no-restricted-syntax
    for (const item of items) {
      const name = $(item)
        .find('title')
        .first()
        .text()
        .trim()
        .replace(/[\t\n]/g, '')
        .replace(/\[(.*?)]/g, '');
      const url = $(item).find('link').first().text().trim();
      const pubDate = $(item).find('pubDate').first().text().trim();
      const description = $(item).find('description').first().html() || '';

      if (!name || !url) {
        this.#postsBar.tick({ cached: this.#numCached, uncached: this.#numUncached });
        continue;
      }

      const cached = cache.find((p) => p.name === name);
      if (cached) {
        this.#numCached += 1;
        if (!cached.imgUrl) {
          const $desc = load(`<div id="root">${description}</div>`);
          const imgUrl = this.#pickImgUrl($desc);
          if (imgUrl) {
            cached.imgUrl = imgUrl;
            this.#numImgBackfills += 1;
          }
        }
        this.#postsBar.tick({ cached: this.#numCached, uncached: this.#numUncached });
        continue;
      }

      /** @type {PatchData} */
      const post = {
        name,
        url,
        date: new Date(pubDate).toISOString().replace(/\.\d{3}Z$/, 'Z'),
        imgUrl: '',
        additions: '',
        changes: '',
        fixes: '',
      };

      this.#fillFromDescription(post, description);
      this.posts.push(post);
      this.#numUncached += 1;
      this.#postsBar.tick({ cached: this.#numCached, uncached: this.#numUncached });

      if (afterEach) {
        await afterEach(this.posts);
      }
    }

    return items.length;
  }

  /**
   * Map RSS description HTML into additions / changes / fixes.
   * @param {PatchData} data post being filled
   * @param {string} descriptionHtml RSS description HTML
   */
  #fillFromDescription(data, descriptionHtml) {
    const $ = load(`<div id="root">${descriptionHtml}</div>`);
    const root = $('#root');
    data.imgUrl = this.#pickImgUrl($);
    let previousCategory = 'fixes';

    root.children().each((i, el) => {
      const strong = title($(el).find('strong').text().trim()).replace(/- /g, '\n');
      const em = $(el).find('em').text().trim().replace(/- /g, '\n');

      if (i === 1 && em) {
        data.description = em;
      } else if (i && strong) {
        ['Fixes', 'Additions', 'Changes'].forEach((type) => {
          if (strong.includes(type)) {
            previousCategory = type.toLowerCase();
          }
        });
      } else if (strong && !strong.includes('Edited ') && !strong.includes(' by ')) {
        if (strong.includes('Fix')) {
          data.fixes += strong + (strong.endsWith(':') ? '\n' : ':\n');
          previousCategory = 'fixes';
        } else {
          data.changes += strong + (strong.endsWith(':') ? '\n' : ':\n');
          previousCategory = 'changes';
        }
      } else {
        const text = $(el).text().trim().replace(/\t/g, '').replace(/[\n]+/g, '\n').replace(/- /g, '\n');
        if (text) {
          data[previousCategory] += `${text}\n`;
        }
      }
    });

    data.type = data.name.includes('Hotfix') ? 'Hotfix' : 'Update';
  }
}

export default new Scraper();

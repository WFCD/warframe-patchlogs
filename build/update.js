import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import scraper from './scraper.js';

const dirName = dirname(fileURLToPath(import.meta.url));

const write = (posts) => {
  // Sort by newest first
  const toWrite = posts.sort((a, b) => {
    const d1 = new Date(a.date);
    const d2 = new Date(b.date);
    return d2 - d1;
  });

  // Store logs so we can re-use them later without additional scraping
  writeFileSync(resolve(dirName, '../data/patchlogs.json'), JSON.stringify(Array.from(new Set(toWrite)), undefined, 2));
};

/**
 * Run the update script
 * @returns {Promise<void>}
 */
async function update() {
  const count = await scraper.scrapeFeed(write);
  if (!count) scraper.interrupt();

  if (!scraper.hasNewPosts) {
    console.info('no new posts in RSS feed');
    return;
  }

  console.info('finished scraping RSS feed (new posts and/or imgUrl backfills)');
  await write(scraper.posts);
}

update();

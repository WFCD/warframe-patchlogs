import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import scraper from './scraper.js';
import sleep from './sleep.js';

const baseUrl = 'https://forums.warframe.com/forum/3-pc-update-build-notes/';

const dirName = dirname(fileURLToPath(import.meta.url));

const write = (posts) => {
  // Sort by newest first
  const toWrite = posts.sort((a, b) => {
    const d1 = new Date(a.date);
    const d2 = new Date(b.date);
    return d2 - d1;
  });

  // Store logs so we can re-use them later without additional scraping
  writeFileSync(resolve(dirName, '../data/patchlogs.json'), JSON.stringify(Array.from(new Set(toWrite)), undefined, 1));
};

/**
 * Run the update script
 * @returns {Promise<void>}
 */
async function update() {
  const pages = await scraper.getPageNumbers();
  if (!pages) scraper.interrupt();
  for (let i = 1; i <= pages; i += 1) {
    const alreadyCachd = await scraper.scrape(`${baseUrl}?page=${i}`);
    if (alreadyCachd) break;
    if (i !== pages - 1) await sleep(250);
  }

  // If we have cached posts, we can skip parsing them again
  await scraper.parsePosts(write);

  console.info('finished scraping update pages, parsing posts...');
  await write(scraper.posts);
}

update();

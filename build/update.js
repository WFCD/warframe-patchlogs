import { writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import scraper from './scraper.js';
import sleep from './sleep.js';

const baseUrl = 'https://forums.warframe.com/forum/3-pc-update-build-notes/';

const dirName = dirname(fileURLToPath(import.meta.url));

/**
 * Run the update script
 * @returns {Promise<void>}
 */
async function update() {
  const pages = await scraper.getPageNumbers();
  if (!pages) scraper.interrupt();
  for (let i = 1; i <= pages; i += 1) {
    await scraper.scrape(`${baseUrl}?page=${i}`);
    if (i !== pages - 1) await sleep(250);
  }

  // Sort by newest first
  scraper.posts.sort((a, b) => {
    const d1 = new Date(a.date);
    const d2 = new Date(b.date);
    return d2 - d1;
  });

  // Store logs so we can re-use them later without additional scraping
  writeFileSync(
    resolve(dirName, '../data/patchlogs.json'),
    JSON.stringify(Array.from(new Set(scraper.posts)), undefined, 1)
  );
}

update();

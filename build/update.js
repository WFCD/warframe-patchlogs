import fs from 'fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import scraper from './scraper.js';
import sleep from './sleep.js';
import ProgressBar from './progress.js';

const baseUrl = 'https://forums.warframe.com/forum/3-pc-update-build-notes/';

const dirName = dirname(fileURLToPath(import.meta.url));

/**
 * Run the update script
 * @returns {Promise<void>}
 */
async function update() {
  const pages = await scraper.getPageNumbers();
  const bar = new ProgressBar('Scraping Page', pages);
  for (let i = 1; i <= pages; i += 1) {
    // console.log(`:: Scraping page ${i}/${pages}`);
    await scraper.scrape(`${baseUrl}?page=${i}`, bar);
    bar.tick({ status: undefined, post: undefined });
    // console.log('\n');
    if (i !== pages - 1) await sleep(2500);
  }

  // Sort by newest first
  scraper.posts.sort((a, b) => {
    const d1 = new Date(a.date);
    const d2 = new Date(b.date);
    return d2 - d1;
  });

  // Store logs so we can re-use them later without additional scraping
  fs.writeFileSync(resolve(dirName, '../data/patchlogs.json'), JSON.stringify(scraper.posts, undefined, 1));
}

update();

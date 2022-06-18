'use strict';

const fs = require('fs');
const path = require('path');
const scraper = require('./scraper');
const sleep = require('./sleep');
const ProgressBar = require('./progress');

const baseUrl = 'https://forums.warframe.com/forum/3-pc-update-build-notes/';

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
  fs.writeFileSync(path.resolve(__dirname, '../data/patchlogs.json'), JSON.stringify(scraper.posts, undefined, 1));
}
update();

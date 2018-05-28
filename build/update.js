const fs = require('fs')
const scraper = require('./scraper.js')
const baseUrl = 'https://forums.warframe.com/forum/3-pc-update-build-notes/'
const sleep = (s) => new Promise(resolve => setTimeout(resolve, s))

async function update () {
  const pages = await scraper.getPageNumbers()

  for (let i = 1; i <= pages; i++) {
    console.log(`:: Scraping page ${i}/${pages}`)
    await scraper.scrape(`${baseUrl}?page=${i}`)
    console.log('\n')
    if (i !== pages - 1) await sleep(2500)
  }

  // Sort by newest first
  scraper.posts.sort((a, b) => {
    const d1 = new Date(a.date)
    const d2 = new Date(b.date)
    return d2 - d1
  })

  // Store logs so we can re-use them later without additional scraping
  fs.writeFileSync(`${__dirname}/../data/patchlogs.json`, JSON.stringify(scraper.posts, null, 1))
}
update()

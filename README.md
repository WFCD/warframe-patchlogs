## warframe-patchlogs
[![npm](https://img.shields.io/npm/v/warframe-patchlogs.svg)](https://npmjs.org/warframe-patchlogs)

[![Supported by Warframe Community Developers](https://warframestat.us/wfcd.png)](https://github.com/WFCD "Supported by Warframe Community Developers")

<br>

All warframe patchlogs parsed to more usable JSON. Also lets you find all
patchlogs for a specific item. This package has primarily been built for
[warframe-items](https://github.com/nexus-devs/warframe-items), so opinionated
decisions are based on the needs of that repository. If you're looking for
patchlogs on *all* items, you can find pre-compiled files there too.

<br>

### Installation
```
npm install warframe-items
```

<br>

### Usage
```js
const Patchlogs = require('warframe-patchlogs')
const patchlogs = new Patchlogs(options)
```
You'll be able to retrieve all posts via `patchlogs.posts`. If you need patchlogs
for a specific item, use `patchlogs.getItemChanges(itemname)`.

<br>

### Options
| Option        | Default       | Description   |
|:------------- |:------------- |:------------- |
| pages | `null` | Number of forum pages to look for posts in. Default fetches ALL posts, which is **not recommended** as it downloads around 200MB of data. We start counting at `1`.

<br>

### License
[MIT](/LICENSE)

import ProgressBar from 'progress';
import chalk from 'chalk';

const prod = process.env.NODE_ENV === 'production';

const plain = (string) =>
  `${string.padEnd(24, ' ')}: ${chalk.green('[')}:bar${chalk.green(']')} :current/:total (:elapseds) :etas remaining `;
const caching = (string) =>
  `${string.padEnd(24, ' ')}: ${chalk.yellow('[')}:bar${chalk.yellow(
    ']'
  )} :current/:total (:elapseds) :etas remaining / :cachedc | :uncachedu`;

/**
 * Simple progress bar
 */
class Progress extends ProgressBar {
  constructor(string, total, bigparse) {
    super(bigparse ? caching(string) : plain(string), {
      incomplete: chalk.red('-'),
      width: 20,
      total,
    });
  }
}

/**
 * Use dummy object in prod because pm2 won't render
 * the progress bar properly.
 */
export default prod
  ? /** @type ProgressBar */ class {
      interrupt() {}

      tick() {}
    }
  : Progress;

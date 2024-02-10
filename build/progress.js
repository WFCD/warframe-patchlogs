import ProgressBar from 'progress';
import chalk from 'chalk';

const prod = process.env.NODE_ENV === 'production';

/**
 * Simple progress bar
 */
class Progress extends ProgressBar {
  constructor(string, total) {
    super(
      `${string.padEnd(24, ' ')}: ${chalk.green('[')}:bar${chalk.green(
        ']'
      )} :current/:total (:elapseds) :etas remaining`,
      {
        incomplete: chalk.red('-'),
        width: 20,
        total,
      }
    );
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

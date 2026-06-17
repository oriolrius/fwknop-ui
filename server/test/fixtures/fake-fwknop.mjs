#!/usr/bin/env node
// Stand-in for the real fwknop client used by the test suite. It never sends a
// packet — it just reports its argv (so tests can assert the wiring) and lets a
// test force a non-zero exit via the `--make-it-fail` flag.
const args = process.argv.slice(2);

if (args.includes('--version')) {
  process.stdout.write('fwknop client 9.9.9, compiled for test\n');
  process.exit(0);
}

if (args.includes('--make-it-fail')) {
  process.stderr.write('simulated knock failure\n');
  process.exit(2);
}

process.stdout.write(`SPA packet generated; argv: ${args.join(' ')}\n`);
process.exit(0);

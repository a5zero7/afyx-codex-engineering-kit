#!/usr/bin/env node
import fs from 'node:fs';
import process from 'node:process';
import { AfyxContextEngine } from './engine.js';
import { AceError } from './errors.js';

const VERSION = '0.1.0';

function usage() {
  return `Afyx Context Engine ${VERSION}

Usage:
  afyx-context reduce --state <absolute-path> --owner <id> --session <id> --input <json-file|-> [--budget <chars>]
  afyx-context get --state <absolute-path> --owner <id> --session <id> --reference <ace:v1:...>
  afyx-context --version
`;
}

function options(args) {
  const parsed = {};
  for (let i = 0; i < args.length; i += 1) {
    const current = args[i];
    if (!current.startsWith('--')) throw new AceError('INVALID_CLI', `unexpected argument: ${current}`);
    const value = args[++i];
    if (value === undefined || value.startsWith('--')) throw new AceError('INVALID_CLI', `missing value for ${current}`);
    parsed[current.slice(2)] = value;
  }
  return parsed;
}

function required(parsed, name) {
  if (!parsed[name]) throw new AceError('INVALID_CLI', `--${name} is required`);
  return parsed[name];
}

function engineFrom(parsed) {
  return new AfyxContextEngine({
    stateDir: required(parsed, 'state'),
    ownerId: required(parsed, 'owner'),
    sessionId: required(parsed, 'session'),
  });
}

function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (!command || command === '--help' || command === 'help') {
    process.stdout.write(usage());
    return;
  }
  if (command === '--version' || command === 'version') {
    process.stdout.write(`${VERSION}\n`);
    return;
  }
  const parsed = options(rest);
  const engine = engineFrom(parsed);
  if (command === 'reduce') {
    const inputPath = required(parsed, 'input');
    const source = inputPath === '-' ? fs.readFileSync(0, 'utf8') : fs.readFileSync(inputPath, 'utf8');
    let request;
    try { request = JSON.parse(source); } catch { throw new AceError('INVALID_INPUT', 'input must be valid JSON'); }
    if (parsed.budget !== undefined) request.budgetChars = Number(parsed.budget);
    process.stdout.write(`${JSON.stringify(engine.reduce(request), null, 2)}\n`);
    return;
  }
  if (command === 'get') {
    process.stdout.write(engine.retrieve(required(parsed, 'reference')));
    return;
  }
  throw new AceError('INVALID_CLI', `unknown command: ${command}`);
}

try {
  main();
} catch (error) {
  const code = error instanceof AceError ? error.code : 'INTERNAL';
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`afyx-context: ${code}: ${message}\n`);
  process.exitCode = error instanceof AceError ? 2 : 1;
}

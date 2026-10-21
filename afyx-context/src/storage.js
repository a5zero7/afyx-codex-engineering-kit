import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { AceError, assertNonEmpty } from './errors.js';

const STATE_FORMAT = 'ace.state/v1';
const SESSION_FORMAT = 'ace.session/v1';

export const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');

function atomicJson(file, value) {
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  try {
    fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporary, file);
  } finally {
    fs.rmSync(temporary, { force: true });
  }
}

function assertNoAliases(target) {
  // Reject an aliased state root itself. Ancestors are intentionally not
  // rejected: macOS commonly exposes /var as a system alias to /private/var.
  if (fs.existsSync(target) && fs.lstatSync(target).isSymbolicLink()) {
    throw new AceError('UNSAFE_STATE_PATH', `state path is a symbolic link: ${target}`);
  }
}

function ensureDirectory(target) {
  if (fs.existsSync(target)) {
    const stat = fs.lstatSync(target);
    if (stat.isSymbolicLink() || !stat.isDirectory()) {
      throw new AceError('UNSAFE_STATE_PATH', `ACE directory is not an owned regular directory: ${target}`);
    }
    return;
  }
  fs.mkdirSync(target, { recursive: true });
}

function assertRegularFile(target) {
  const stat = fs.lstatSync(target);
  if (stat.isSymbolicLink() || !stat.isFile()) {
    throw new AceError('UNSAFE_STATE_PATH', `ACE file is not an owned regular file: ${target}`);
  }
}

export class ContextStore {
  constructor({ stateDir, ownerId, sessionId }) {
    assertNonEmpty(stateDir, 'stateDir');
    assertNonEmpty(ownerId, 'ownerId');
    assertNonEmpty(sessionId, 'sessionId');
    if (!path.isAbsolute(stateDir)) {
      throw new AceError('UNSAFE_STATE_PATH', 'stateDir must be absolute');
    }
    this.stateDir = path.resolve(stateDir);
    this.ownerHash = sha256(ownerId);
    this.sessionHash = sha256(sessionId);
    assertNoAliases(this.stateDir);
    ensureDirectory(this.stateDir);
    this.#initialize();
  }

  #initialize() {
    const manifestPath = path.join(this.stateDir, 'state.json');
    if (fs.existsSync(manifestPath)) {
      const manifest = this.#readJson(manifestPath, 'INVALID_STATE');
      if (manifest.format !== STATE_FORMAT || manifest.ownerHash !== this.ownerHash) {
        throw new AceError('FOREIGN_STATE', 'state belongs to a different owner or format');
      }
    } else {
      const entries = fs.readdirSync(this.stateDir);
      if (entries.length !== 0) {
        throw new AceError('AMBIGUOUS_STATE', 'state directory is non-empty and has no ACE ownership manifest');
      }
      atomicJson(manifestPath, { format: STATE_FORMAT, ownerHash: this.ownerHash });
    }

    this.contentDir = path.join(this.stateDir, 'content');
    this.sessionDir = path.join(this.stateDir, 'sessions', this.sessionHash);
    ensureDirectory(this.contentDir);
    ensureDirectory(path.dirname(this.sessionDir));
    ensureDirectory(this.sessionDir);
    this.sessionPath = path.join(this.sessionDir, 'session.json');
    if (fs.existsSync(this.sessionPath)) {
      const session = this.#readJson(this.sessionPath, 'INVALID_SESSION');
      if (session.format !== SESSION_FORMAT || session.ownerHash !== this.ownerHash || session.sessionHash !== this.sessionHash || !Array.isArray(session.content) || !session.records || typeof session.records !== 'object') {
        throw new AceError('INVALID_SESSION', 'session metadata is invalid or does not match this owner/session');
      }
    } else {
      atomicJson(this.sessionPath, {
        format: SESSION_FORMAT,
        ownerHash: this.ownerHash,
        sessionHash: this.sessionHash,
        content: [],
        records: {},
      });
    }
  }

  #readJson(file, code) {
    try {
      assertRegularFile(file);
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    } catch (error) {
      if (error instanceof AceError) throw error;
      throw new AceError(code, `ACE metadata is unreadable: ${path.basename(file)}`);
    }
  }

  knownDigests() {
    return new Set(this.#readJson(this.sessionPath, 'INVALID_SESSION').content);
  }

  persist(segments) {
    const session = this.#readJson(this.sessionPath, 'INVALID_SESSION');
    const known = new Set(session.content);
    const records = { ...session.records };
    for (const segment of segments) {
      const { content } = segment;
      const digest = sha256(content);
      const target = path.join(this.contentDir, `${digest}.txt`);
      if (fs.existsSync(target)) {
        assertRegularFile(target);
        const existing = fs.readFileSync(target, 'utf8');
        if (sha256(existing) !== digest || existing !== content) {
          throw new AceError('CONTENT_INTEGRITY', 'stored original content failed integrity validation');
        }
      } else {
        fs.writeFileSync(target, content, { encoding: 'utf8', flag: 'wx' });
      }
      known.add(digest);
      const observation = {
        id: segment.id,
        classification: segment.classification,
        provenance: segment.provenance,
      };
      const observations = Array.isArray(records[digest]) ? records[digest] : [];
      const encoded = JSON.stringify(observation);
      if (!observations.some((item) => JSON.stringify(item) === encoded)) observations.push(observation);
      records[digest] = observations;
    }
    atomicJson(this.sessionPath, { ...session, content: [...known].sort(), records });
  }

  reference(content) {
    return `ace:v1:${this.ownerHash.slice(0, 16)}:${this.sessionHash.slice(0, 16)}:${sha256(content)}`;
  }

  retrieve(reference) {
    const match = /^ace:v1:([0-9a-f]{16}):([0-9a-f]{16}):([0-9a-f]{64})$/.exec(reference);
    if (!match) throw new AceError('INVALID_REFERENCE', 'reference is not an ACE v1 reference');
    if (match[1] !== this.ownerHash.slice(0, 16) || match[2] !== this.sessionHash.slice(0, 16)) {
      throw new AceError('REFERENCE_BOUNDARY', 'reference belongs to a different owner or session');
    }
    const known = this.knownDigests();
    if (!known.has(match[3])) throw new AceError('REFERENCE_BOUNDARY', 'reference is not owned by this session');
    const target = path.join(this.contentDir, `${match[3]}.txt`);
    let content;
    try {
      assertRegularFile(target);
      content = fs.readFileSync(target, 'utf8');
    } catch (error) {
      if (error instanceof AceError) throw error;
      throw new AceError('MISSING_ORIGINAL', 'referenced original content is unavailable');
    }
    if (sha256(content) !== match[3]) {
      throw new AceError('CONTENT_INTEGRITY', 'referenced original content failed integrity validation');
    }
    return content;
  }

  retrieveRecord(reference) {
    const content = this.retrieve(reference);
    const digest = sha256(content);
    const session = this.#readJson(this.sessionPath, 'INVALID_SESSION');
    return {
      reference,
      digest,
      content,
      observations: session.records[digest] ?? [],
    };
  }
}

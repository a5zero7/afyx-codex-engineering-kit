#!/usr/bin/env node
/** Canonical Afyx Graph artifact identity shared by Windows and POSIX lifecycle scripts. */
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

const UNKNOWN = 'UNKNOWN';

function argument(name, fallback = '') {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

function revision(value) {
  const normalized = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{7,64}$/.test(normalized) ? normalized : UNKNOWN;
}

function integer(value) {
  const parsed = Number.parseInt(String(value ?? ''), 10);
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

function readMetadata(file) {
  return JSON.parse(readFileSync(file, 'utf8').replace(/^\uFEFF/, ''));
}

function writeMetadata(file, metadata) {
  writeFileSync(file, `${JSON.stringify(metadata, null, 2)}\n`, 'utf8');
}

export function artifactIdentity(metadata) {
  return {
    schema: integer(metadata.artifact_identity_schema),
    productVersion: String(metadata.product_version || ''),
    releaseChannel: String(metadata.release_channel || ''),
    target: String(metadata.artifact_target || UNKNOWN),
    sourceRevision: revision(metadata.source_revision),
    buildIdentity: String(metadata.build_identity || UNKNOWN),
    extractionVersion: integer(metadata.extraction_version),
    provenance: String(metadata.artifact_provenance || UNKNOWN),
    archiveSha256: /^[0-9a-f]{64}$/i.test(String(metadata.archive_sha256 || ''))
      ? String(metadata.archive_sha256).toLowerCase()
      : UNKNOWN,
    requestedCheckoutRevision: revision(metadata.requested_checkout_revision),
  };
}

export function stampArtifact(metadata, fields) {
  const sourceRevision = revision(fields.revision);
  return {
    ...metadata,
    artifact_identity_schema: 1,
    artifact_target: fields.target,
    source_revision: sourceRevision,
    build_identity: sourceRevision === UNKNOWN ? UNKNOWN : `git:${sourceRevision}`,
    extraction_version: integer(fields.extractionVersion),
  };
}

export function revisionStatus(identity, requested) {
  const wanted = revision(requested);
  if (wanted === UNKNOWN || identity.sourceRevision === UNKNOWN) return 'UNKNOWN';
  return identity.sourceRevision === wanted ? 'MATCH' : 'REVISION_MISMATCH';
}

export function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex');
}

function requireValue(value, name) {
  if (!value) throw new Error(`${name} is required`);
  return value;
}

try {
  const command = process.argv[2];
  const file = requireValue(argument('--metadata'), '--metadata');
  if (command === 'stamp') {
    const stamped = stampArtifact(readMetadata(file), {
      target: requireValue(argument('--target'), '--target'),
      revision: argument('--revision', UNKNOWN),
      extractionVersion: requireValue(argument('--extraction-version'), '--extraction-version'),
    });
    writeMetadata(file, stamped);
    console.log(JSON.stringify(artifactIdentity(stamped)));
  } else if (command === 'inspect') {
    const identity = artifactIdentity(readMetadata(file));
    const requested = argument('--requested-revision', UNKNOWN);
    console.log(JSON.stringify({ ...identity, revisionStatus: revisionStatus(identity, requested) }));
  } else if (command === 'require-revision') {
    const identity = artifactIdentity(readMetadata(file));
    const requested = requireValue(argument('--requested-revision'), '--requested-revision');
    const status = revisionStatus(identity, requested);
    console.log(JSON.stringify({ ...identity, revisionStatus: status }));
    if (status !== 'MATCH') process.exitCode = status === 'REVISION_MISMATCH' ? 3 : 4;
  } else if (command === 'record-install') {
    const metadata = readMetadata(file);
    const archive = requireValue(argument('--archive'), '--archive');
    const requested = argument('--requested-revision', UNKNOWN);
    const updated = {
      ...metadata,
      artifact_provenance: requireValue(argument('--provenance'), '--provenance'),
      archive_sha256: sha256(archive),
      requested_checkout_revision: revision(requested),
      revision_status: revisionStatus(artifactIdentity(metadata), requested),
    };
    writeMetadata(file, updated);
    console.log(JSON.stringify(artifactIdentity(updated)));
  } else {
    throw new Error('usage: afyx-graph-artifact.mjs stamp|inspect|require-revision|record-install [options]');
  }
} catch (error) {
  console.error(`[artifact] ${error instanceof Error ? error.message : String(error)}`);
  process.exitCode = 1;
}

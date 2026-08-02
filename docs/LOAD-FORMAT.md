# MUTHUR Format Family and `.muthur.load` Specification

Status: draft v0.1

Protocol: MUTHURLOAD

Canonical file extension: `.muthur.load`

Legacy short extension: `.load`

Media type: `application/vnd.keepseek.muthurload+zip`

## 1. Scope

Version 0.1 defines the smallest complete MUTHURLOAD artifact that can travel between two Keepseek libraries or other compatible intelligences. Its first reference artifact is `the-muthur-manifesto.muthur.load`.

The format is local-first. Creating, inspecting, hashing, compressing, and importing a Load happen on the user's device. Keepseek does not upload a Load unless the user explicitly shares it through another service.

### 1.1 MUTHUR filename namespace

MUTHUR uses a recognizable compound-extension namespace:

| Extension | Role | Status |
|---|---|---|
| `.muthur.load` | Canonical inert knowledge capsule containing Drops, Wads, indexes, media, and provenance | Defined in v0.1 |
| `.muthur.html` | Optional self-viewing HTML envelope that a browser can open without Keepseek | Reserved |
| `.muthur.strand` | Signed transport, routing, permission, and synchronization description that carries or connects Loads | Reserved |
| `.muthur.slime` | Portable snapshot or fragment of the linked intelligence graph formed among Loads and intelligences | Reserved |

Examples:

```text
the-muthur-manifesto.muthur.load
the-muthur-manifesto.muthur.html
research-exchange.muthur.strand
career-intelligence.muthur.slime
```

The filename is a human and operating-system hint. The internal manifest, declared media type, version, and verified cryptographic identity are authoritative. A reader MUST NOT infer trust or format validity from the filename alone.

The `.load` short extension produced by early Keepseek builds remains a compatible legacy alias for `.muthur.load`. Writers SHOULD emit `.muthur.load`; readers SHOULD accept both during migration.

All members of the MUTHUR format family are inert data. A `.muthur.html` file MAY execute only its browser-sandboxed viewer code; its embedded Load remains inert and independently verifiable.

## 2. Physical container

A `.muthur.load` file is a ZIP-compatible binary container. The compound extension expresses its MUTHURLOAD identity; ordinary ZIP tools may still inspect its envelope.

The required logical layout for v0.1 is:

```text
the-muthur-manifesto.muthur.load
├── manifest.json
├── indexes/
│   └── root.json
├── scraps/
│   └── manifesto.json
└── content/
    └── the-muthur-manifesto.md
```

Every v0.1 Load MUST contain `manifest.json` at the container root. Keepseek MUST validate the manifest identity before treating a ZIP-compatible file as a Load.

## 3. Compression

Version 0.1 uses ZIP Deflate compression implemented in Keepseek with `fflate`.

| Content | ZIP method |
|---|---|
| Markdown | Deflate, level 6 |
| JSON | Deflate, level 6 |
| Plain text | Deflate, level 6 |
| JPEG, PNG, WebP, audio, video, and other already-compressed media | Store without recompression |

Level 6 is the default balance between compression ratio and browser-side speed. Encoders MAY expose other levels later, but readers MUST NOT depend on a particular Deflate level.

### 3.1 No recursive compression

Objects are compressed once. A compressed response MUST NOT be recompressed to form a thread, and compressed threads MUST NOT be recompressed to form a forum. Higher-level structures organize compressed objects through indexes and hashes.

> Compress at the level you want to seek, then organize the compressed blocks. Do not repeatedly compress compressed data.

## 4. Hashing and integrity

Every logical object is hashed with SHA-256 before ZIP compression.

The digest is calculated over the exact uncompressed bytes stored for that object. The resulting lowercase hexadecimal digest is recorded in the containing index or manifest.

The Load root hash is derived from the ordered logical object hashes declared by `indexes/root.json`. It MUST NOT be calculated from the final ZIP bytes because ZIP metadata, entry order, timestamps, and encoder behavior may change without changing the knowledge represented by the Load.

Hashes provide identity, integrity, deduplication, and lineage. They are not encryption.

## 5. Manifest

`manifest.json` MUST be UTF-8 JSON and MUST include at least:

```json
{
  "format": "muthurload",
  "version": "0.1",
  "mediaType": "application/vnd.keepseek.muthurload+zip",
  "createdAt": "2026-08-01T00:00:00.000Z",
  "createdBy": "keepseek",
  "compression": {
    "container": "zip",
    "method": "deflate",
    "level": 6
  },
  "hashing": {
    "algorithm": "sha-256",
    "root": "<lowercase-hex-digest>"
  },
  "entrypoint": "indexes/root.json"
}
```

Unknown fields MUST be ignored by compatible readers unless the manifest explicitly marks them as required.

## 6. First reference Load

`the-muthur-manifesto.muthur.load` contains:

- the complete MUTHUR Manifesto Markdown;
- the original GitHub URL as provenance;
- the Keepseek scrap title, note, collection, and visual palette;
- creation time and format version;
- the SHA-256 digest of each uncompressed logical object;
- a root index and root hash covering the capsule.

The source URL records lineage, but the Markdown content is carried inside the Load. The artifact therefore remains readable offline and survives changes to the original page.

## 7. Reader behavior

When opening a v0.1 Load, Keepseek MUST:

1. Confirm that `manifest.json` exists.
2. Validate `format` as `muthurload` and support the declared version.
3. Reject unsafe paths, path traversal, and unreasonable expanded sizes.
4. Read the root index.
5. Verify SHA-256 hashes over uncompressed object bytes.
6. Show a preview before changing the local OPFS library.
7. Import only after an explicit user action.

The primary v0.1 actions are:

- **Create Load** — package a local artifact.
- **Share Load** — hand the resulting file to a user-selected transport.
- **Open Load** — validate and preview without importing.
- **Take Load** — accept the complete capsule into Keepseek.

The later vocabulary is reserved as:

- **Take Drop** — accept one scrap.
- **Take Wad** — accept a selected bundle of scraps.

## 8. Forward direction

Later versions may add encryption, independently compressed seekable blocks, partial transfer, forum/thread indexes, content-addressed media objects, and Zstandard. None are required for the first interoperable Load.

Version 0.1 succeeds when one Keepseek instance creates `the-muthur-manifesto.muthur.load`, another opens and verifies it, and the recipient can Take Load into its local library.

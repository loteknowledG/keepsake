# MUTHURLOAD

Status: architectural proposal for Keepseek

Related doctrine: [The MUTHUR Manifesto](./THE-MUTHUR-MANIFESTO.md)

## Purpose

Keepseek is local-first: a person's library belongs in their browser-side SQLite/OPFS database and is never uploaded merely because it was saved. MUTHURLOAD is the explicit sharing and transport layer for that local library.

> Keepseek owns your library. MUTHURLOAD carries only what you choose to share.

MUTHURLOAD should support two complementary transports:

- **Link capsule:** small notes, scraps, or context compressed and encoded in a URL fragment. The static Keepseek viewer receives no payload on the server; the link is the document.
- **File capsule:** a binary `.muthurload` container for complete scraps, collections, thumbnails, images, threads, or forums. The file can be downloaded, attached, or passed to the operating-system share sheet.

Both forms are created locally. Encryption may be applied before the capsule leaves the device.

## Seekable compression

A forum demonstrates the central design problem. It contains threads, each thread contains responses, and responses may contain attachments. Compressing the entire forum as one stream may produce a strong compression ratio, but Keepseek would have to decompress the entire archive to read one response.

Compressing every response separately gives excellent random access, but loses some compression efficiency because neighboring responses often repeat vocabulary, participant names, markup, and quoted text.

MUTHURLOAD therefore compresses at the level Keepseek needs to seek.

```text
Forum index
├── Thread index
│   ├── Compressed message block
│   ├── Compressed message block
│   └── Compressed attachment object
└── Thread index
    ├── Compressed message block
    └── Compressed message block
```

Recommended message blocks are bounded by a target such as 50 responses or 128–256 KiB of uncompressed data. Keepseek first reads the small forum index, resolves a thread and block, then decompresses only the neighborhood containing the sought response.

### Do not recursively compress

Already-compressed bytes contain little reusable redundancy. Recompressing individual compressed responses into a compressed thread, and recompressing compressed threads into a forum, generally adds container overhead and may increase the final size.

The rule is:

> Compress a block once, then organize compressed blocks with indexes. Do not repeatedly compress compressed data.

## Compression and access tradeoff

| Compression unit | Expected size | Access behavior |
|---|---:|---|
| Whole forum | Potentially smallest | Decompress everything |
| Whole thread | Very good | Decompress one thread |
| Individual response | Slightly larger | Open one response immediately |
| Bounded message block | Balanced | Decompress a small response neighborhood |

The bounded-block design accepts a small size premium in exchange for fast seeking, partial transfer, incremental updates, and low memory use.

## Content-addressed hierarchy

Every stored object receives a content hash. Parent indexes contain the hashes of their children:

```text
Response or block hash
        ↓
Thread root hash
        ↓
Forum root hash
```

This produces a Merkle-style content tree. Hashes are identities and integrity receipts, not compression. They enable:

- verification that content arrived unchanged;
- deduplication of repeated messages, quotes, images, and attachments;
- transfer of only missing or changed blocks;
- stable references to specific responses and thread snapshots;
- reconstruction of a forum without opening every object;
- proof that a thread belongs to a particular forum snapshot.

An implementation should choose a modern cryptographic digest and record its algorithm alongside each hash so the format can evolve.

## File capsule layout

A `.muthurload` file may use ZIP as its physical envelope while defining a Keepseek-specific logical format:

```text
shared-forum.muthurload
├── manifest.json
├── indexes/
│   ├── forum.json
│   └── threads/
├── blocks/
│   └── <content-hash>.bin
├── objects/
│   └── <content-hash>.bin
└── preview.webp
```

Each block or object is independently compressed. The manifest declares the format version, compression algorithm, hashing algorithm, root hash, encryption information, and the index entry point. Large images and attachments remain separate objects so reading text never requires inflating unrelated media.

The `.muthurload` extension gives the capsule an explicit product identity even if compatible tools can inspect its ZIP envelope.

## Import and sharing behavior

When Keepseek opens a MUTHURLOAD capsule, it should:

1. Read and validate the manifest.
2. Verify the requested root and index hashes.
3. Show a safe preview before changing the local library.
4. Decompress only the blocks needed for that preview.
5. Let the recipient keep individual scraps, selected threads, or the complete capsule.
6. Deduplicate imported objects against content already present in local OPFS storage.

Creating and opening capsules must remain local operations. Sharing is always deliberate; opening a capsule does not silently upload its contents or import everything into the library.

## Design principle

MUTHURLOAD is not simply an archive format. It is a seekable, verifiable context carrier for local-first knowledge.

> Compress at the level you want to seek, hash at the level you want to verify, and share only what the user chooses to carry.

# MUTHUR Renderer and Link Architecture

Status: design record

Date: 2026-08-02

Related protocol: MUTHURLOAD v0.1

## 1. The boundary

The architecture separates bookmarking, portable knowledge, and rendering into distinct responsibilities:

```text
KEEPSEEK = bookmarking
LOAD     = portable knowledge
MUTHUR   = verification and rendering
```

Keepseek captures websites, notes, images, colors, and collections. It creates and accepts Loads as part of bookmarking, but it is not the universal Load renderer.

MUTHUR is a separate, stateless application and website. It opens, verifies, and renders Loads produced by Keepseek or any future compatible human or machine tool. It has no accounts, collections, editing workflow, or permanent library.

MUTHUR should live in its own repository, Vercel project, PWA identity, and public site. It consumes the MUTHURLOAD specification rather than depending on Keepseek's UI or storage implementation.

## 2. Core rendering pipeline

MUTHUR separates interpretation from presentation:

```text
.muthur.load
      ↓
MUTHUR Core
  container validation
  path and size validation
  manifest parsing
  object hash verification
  root hash verification
      ↓
normalized Load model
      ↓
MUTHUR Renderer
  bookmark cards
  Markdown documents
  image galleries
  conversations
  collections
  relationship graphs
```

HTML is the canonical human rendering target because browsers, PWAs, WebViews, Electron, Tauri, accessibility tools, printers, and browser-using AIs can consume it. The normalized Load model remains the canonical machine-facing representation; an AI does not need to consume the HTML.

The sender supplies knowledge. The receiver supplies the interpreter.

## 3. File-opening behavior

The canonical portable artifact is:

```text
the-muthur-manifesto.muthur.load
```

When the MUTHUR PWA is installed, it registers `.muthur.load` through the browser File Handling API. Double-clicking the file launches MUTHUR, which receives it through `launchQueue`, verifies it, and renders it locally.

Without the PWA, an operating system cannot automatically associate an unknown extension with a website. The zero-install path is:

```text
visit MUTHUR
→ choose or drop .muthur.load
→ verify
→ render
```

PWA installation is therefore an enhancement, not an adoption prerequisite.

## 4. The `.muthur.html` question

A self-contained `.muthur.html` could embed a Load and JavaScript renderer and open in any browser. It would be convenient and interactive, but it would also bring its own executable interpreter. A malicious sender could modify the payload, renderer, and claimed security policy together. A self-executing document cannot establish its own honesty.

A static, script-free HTML snapshot would be safer but would weaken the living, interactive experience. An HTML file that only links to MUTHUR would add little value and could not silently transfer its local embedded payload to a remote website because browsers correctly require user permission for local file access.

Current direction:

- `.muthur.load` remains the canonical inert artifact.
- The trusted MUTHUR application supplies executable renderer code.
- `.muthur.html` is explored but is not required for the core system.
- If retained later, it is a convenience representation rather than a source of truth.

The existing format specification currently reserves `.muthur.html`; that reservation should be reconsidered before the next specification revision.

## 5. Security model

File extensions are labels, not proof. Renaming an executable does not convert it into a valid Load. MUTHUR verifies the actual container and logical structure.

MUTHUR MUST:

1. Require the ZIP-compatible container expected by MUTHURLOAD v0.1.
2. Require and validate `manifest.json` and the root index.
3. Reject absolute paths, traversal paths, links, duplicate-path ambiguity, oversized entries, excessive expansion, and ZIP bombs.
4. Verify every uncompressed object hash and the logical root hash.
5. Render only allowlisted media types.
6. Treat executables, scripts, macros, and unknown binaries as opaque blocked attachments.
7. Never execute Load content, call the operating system to open it, or extract it into sensitive filesystem locations.
8. Sanitize Markdown and HTML and place complex previews inside restricted sandboxes.
9. Distinguish integrity from trust: hashes prove identity and integrity; signatures establish provenance; neither proves that arbitrary content is harmless.

A valid Load may carry dangerous bytes. MUTHUR's guarantee is not that every carried byte is benevolent; it is that untrusted carried content is treated as data and never becomes the interpreter.

## 6. MUTHUR Link

`muthur.link` is the proposed universal clickable doorway and public renderer domain, not a file extension.

```text
https://muthur.link/l/<load-id>
```

HTTPS works without installation because browsers already handle the `https:` protocol. A MUTHUR Link can obtain Load bytes through several explicit transports.

### 6.1 Embedded small Load

```text
https://muthur.link/open#<base64url-load>
```

The browser reconstructs the Load from the URL fragment. Fragment data is normally not sent to the server. This is local-first but practical only for small Loads because URLs become long.

### 6.2 Encrypted temporary blob

For larger private Loads, the sender encrypts the Load in the browser, uploads only ciphertext, and receives an identifier:

```text
https://muthur.link/l/abc123#decryption-key
```

The server retrieves ciphertext by identifier. The browser reads the fragment key, decrypts locally, verifies the Load, and renders it. The key is not intentionally sent to the server. Expiration and explicit deletion should be supported.

### 6.3 Existing public source

MUTHUR may fetch a public Load from GitHub, an object store, a CDN, or another compatible origin. The declared MUTHUR root hash remains authoritative regardless of transport.

## 7. Torrent resilience

A public Load may also be distributed as a torrent. In the browser, MUTHUR embeds WebTorrent and becomes a temporary WebRTC torrent client without requiring an external application, browser extension, or PWA installation.

The recommended transport order is:

```text
1. Fetch through HTTPS
2. If unavailable, slow, or invalid, join the WebTorrent swarm
3. Reconstruct the .muthur.load
4. Verify the expected MUTHUR root hash
5. Render only after verification
6. Optionally seed while the MUTHUR tab remains open
```

A MUTHUR Link descriptor can carry multiple sources:

```json
{
  "format": "muthurlink",
  "version": "0.1",
  "rootHash": "<muthur-root-hash>",
  "sources": [
    {
      "type": "https",
      "url": "https://cdn.muthur.link/loads/<id>.muthur.load"
    },
    {
      "type": "webtorrent",
      "magnet": "magnet:?xt=urn:btih:<torrent-info-hash>"
    }
  ]
}
```

HTTPS provides immediate availability. Torrent distribution provides resilience and community-assisted delivery. An HTTP web seed may bridge both. Browser WebTorrent requires WebRTC-capable peers and signaling infrastructure; ordinary BitTorrent peers are not automatically reachable from browser peers. Peer-to-peer transfer also exposes network-address information to peers and ends when the browser tab closes unless another compatible seeder remains.

Tiny Loads should use HTTPS or embedded links because torrent metadata and coordination cost can exceed the payload. Torrents become valuable for large Loads, popular public archives, Wads, media-rich knowledge, and replicated AI exchange.

Transport does not establish trust. Whether bytes arrive from HTTPS, a CDN, one peer, or a thousand peers, MUTHUR renders them only when they reconstruct the expected verified Load.

## 8. Adoption path

MUTHUR does not require prior popularity to become useful:

```text
1. Keepseek creates a .muthur.load
2. A recipient opens muthur.link or visits the MUTHUR site
3. MUTHUR verifies and renders the Load without installation
4. Frequent users install the PWA for native double-click behavior
5. Keepseek, Echo Mirage, CLIs, forums, and AI tools produce and consume Loads
6. Popular public Loads gain peer-assisted torrent resilience
```

The first compelling loop is deliberately small:

```text
Create in Keepseek
→ send .muthur.load
→ open safely in MUTHUR
→ understand it immediately
```

## 9. Current implementation status

- Keepseek can create, open, validate, and Take a v0.1 legacy `.load` artifact.
- The first generated artifact, `the-muthur-manifesto.load`, passed independent container and SHA-256 object verification.
- `.muthur.load` is the canonical filename direction; the shorter `.load` remains a migration alias.
- The standalone MUTHUR repository and website have not yet been created.
- No MUTHUR Link hosting, encryption service, share-link encoding, WebTorrent transport, STRAND implementation, or SLIME implementation exists yet.

## 10. Next execution boundary

Build MUTHUR as an independent stateless project with:

1. Drag/drop and file-picker intake for `.muthur.load` and legacy `.load`.
2. The shared v0.1 validation and hash-verification pipeline.
3. Safe bookmark and Markdown rendering.
4. Provenance, version, object list, root hash, and trust-state display.
5. Installable PWA metadata and `.muthur.load` file handling where supported.
6. No accounts, permanent storage, editing, or bookmarking.

MUTHUR Link and WebTorrent remain the following transport phase after the renderer is real and interoperable.

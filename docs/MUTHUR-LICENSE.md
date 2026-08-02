# MUTHUR Free Protocol Licensing Charter

Status: adopted for the MUTHUR protocol direction

Date: 2026-08-02

## 1. Declaration

MUTHUR is a free knowledge-exchange protocol. No company, hosted service, application, storage provider, or network is required to create, inspect, verify, transport, or render a conforming MUTHUR artifact.

```text
The protocol is free.
The renderer is replaceable.
Infrastructure is user-selected.
Knowledge remains its creator's own.
```

## 2. Protocol materials: CC0-1.0

The following MUTHUR materials are dedicated to the public domain under the Creative Commons CC0 1.0 Universal dedication (`CC0-1.0`):

- protocol specifications;
- schemas;
- media-type and extension definitions;
- compatibility rules;
- test vectors;
- example manifests and indexes;
- reference Loads created solely for interoperability testing;
- conformance fixtures and protocol vocabulary.

Anyone may copy, implement, modify, translate, publish, sell, embed, extend, or replace these materials without requesting permission or paying a fee.

Canonical license text: https://creativecommons.org/publicdomain/zero/1.0/legalcode

SPDX identifier: `CC0-1.0`

## 3. Reference software: Apache-2.0

Official MUTHUR reference implementations, libraries, command-line tools, renderers, and self-hostable services are licensed under the Apache License 2.0 (`Apache-2.0`) unless a source file or directory clearly states otherwise.

Apache-2.0 permits use, reproduction, modification, distribution, sublicensing, and commercial use. It also includes an express patent license from contributors, subject to its terms and conditions.

Canonical license text: https://www.apache.org/licenses/LICENSE-2.0

SPDX identifier: `Apache-2.0`

Every standalone MUTHUR code repository SHOULD include the complete Apache-2.0 `LICENSE` text and appropriate copyright and NOTICE information.

## 4. Infrastructure freedom

A conforming implementation MUST NOT require one exclusive provider in order to understand the protocol.

MUTHUR implementations may use any transport or storage selected by the user, including:

- local files and removable media;
- local networks;
- Google Drive, Box, WebDAV, or S3-compatible storage;
- Git repositories and ordinary HTTPS origins;
- Wormhole or another encrypted transfer service;
- WebTorrent, IPFS, or another peer-to-peer network;
- an official MUTHUR Link service;
- a personal, organizational, or AI-operated self-hosted node.

An official hosted service is a convenience instance, not the protocol authority. Loss of that service MUST NOT invalidate existing Loads or prevent independent implementations from opening them.

## 5. User content is not relicensed

This charter does not change the copyright or license of knowledge carried inside a `.muthur.load`.

The author or lawful rights holder controls the license of embedded writing, images, media, datasets, and other content. A Load SHOULD carry explicit per-object rights and provenance metadata when known.

Packaging content inside a Load does not place that content under CC0 or Apache-2.0. Protocol metadata, schemas, and reference implementation code remain separate from payload rights.

## 6. Contributions

Unless a contribution clearly states otherwise before acceptance:

- contributions to protocol materials are contributed under `CC0-1.0`;
- contributions to reference software are contributed under `Apache-2.0`;
- contributors represent that they have the right to submit their contribution under the applicable license.

Projects may require a Developer Certificate of Origin sign-off for contribution provenance. A separate contributor license agreement is not required by this charter.

## 7. Compatibility and naming

The licenses permit independent and competing implementations. Software may truthfully describe itself as "MUTHUR-compatible" when it passes the published conformance requirements for the version it claims.

Licensing the protocol does not grant permission to impersonate the official project, misrepresent compatibility, or falsely claim endorsement. Any future logo or certification mark policy MUST remain separate from protocol access and MUST NOT be used to prevent interoperable implementations.

## 8. No execution requirement

No license or conformance rule may require a recipient to execute code supplied by a Load creator. A conforming receiver may use its own trusted interpreter and may reject, quarantine, or decline to render unsafe or unsupported objects.

## 9. No warranty

MUTHUR protocol materials and reference software are provided without warranties or conditions except as stated in their applicable standard license texts. Implementers and users remain responsible for security review, lawful content handling, backups, and deployment choices.

## 10. License map

```text
specifications / schemas / test vectors  → CC0-1.0
reference software / renderer / server   → Apache-2.0
third-party dependencies                 → their existing licenses
knowledge carried inside a Load          → content owner's chosen license
hosting and transport                    → user's choice
```

## 11. Constitutional rule

> MUTHUR is a free knowledge-exchange protocol. Infrastructure is replaceable, user-selected, and optional.

Any future protocol revision that makes one vendor, hosted service, account system, or proprietary renderer mandatory contradicts this charter.

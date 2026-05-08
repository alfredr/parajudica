# Changelog

## Unreleased

### Fixed

- **Inference: `ConditionalImplication` with `fromAllLabels` and a condition now fires correctly.**
  Previously the path was dead in two compounding ways:
  (a) the AND/OR composite-condition branches in
  `inference/metamodel/pj/constructs/implications/evaluate-from-all.rq`
  used a trivially-true `FILTER EXISTS { ?subCondition a ?subCondType }`
  instead of consulting `:ConditionEvaluation` triples — meaning the
  condition was not actually enforced;
  (b) the `?newAssertion` subject of the CONSTRUCT was unbound in the WHERE,
  so the engine produced no triples even when the WHERE matched.
  Bug (b) masked bug (a) on the example corpus, so no published results
  changed; but any future framework using `fromAllLabels` with a condition
  would have silently misbehaved.

  The fix:
  - Rewrites `evaluate-from-all.rq` to consume `:ConditionEvaluation`
    directly (condition-type-agnostic), with a deterministic
    `BIND(IRI(...))` for `?newAssertion`.
  - Adds `constructs/conditions/composite/mark/conditional-implication-from-all.rq`
    to mark conditions on `fromAllLabels` implications (the existing mark
    query only handled singular `fromLabel`).
  - Registers the new mark query in `inference/metamodel/pj/framework.toml`.

  Verified by a synthetic test (`/tmp/unsoundness-test/`) where a container
  has the required `fromAllLabels` but lacks a label required by the
  composite `AND containsLabel ...` condition: target label correctly does
  not fire (was previously firing under the patched-`?newAssertion` variant).
  All five `make challenge1`–`challenge5` runs reproduce.

### Changed

- **Renamed the `:Identifier` facet to `:IdentifierFacet`** in
  `examples/frameworks/base/model/base.ttl` to remove the dual typing
  (a single name was both `pj:Facet` and `pj:ComplianceLabel`, with the
  facet appearing in its own membership relation). The compliance label
  parent class keeps the name `:Identifier`; the facet is now distinct.
  Touched: line 11 (facet list), line 85 (facet declaration), and four
  `pj:belongsToFacet :Identifier` references (lines 98, 103, 109, 115).
  `rdfs:subClassOf :Identifier` references and the `pj:hasLabel :Identifier`
  entry are unchanged — they refer to the compliance label, not the facet.
  `make challenge1`–`challenge5` reproduce identically (same rounds, same
  labels). Paper edits applied locally in `paper/main.tex` (not pushed to
  Overleaf submodule).

### Deferred / TODO

- **Namespace resolution (w3id.org / LOV registration).** Verified
  `https://openprovenance.org/ns/parajudica` resolves with
  `Content-Type: text/turtle`, but all six framework facet namespaces
  (`facet/base`, `facet/hipaa`, `facet/gdpr`, `facet/ema`, `facet/italy`,
  `facet/sdc`) return HTTP 404. Two options for follow-up:
  (a) host the missing TTLs at the existing `openprovenance.org` paths
  (sources already in `examples/frameworks/*/model/*.ttl`), or
  (b) migrate prefixes to `https://w3id.org/parajudica/...` and submit
  a PR to `perma-id/w3id.org` with the redirect rules. Then submit the
  vocabulary to LOV.

### Documentation

- **Paper Figure 8 (`fig:and-condition`) now reflects the actual implementation.**
  The figure previously depicted a fictional `:ConditionCountAssertion` /
  `?satisfied`/`?total` count-based query (with `?count` unbound, as flagged
  by an ESWC reviewer). The class never existed in code. Replaced the figure
  body with a faithful condensation of
  `inference/metamodel/pj/constructs/conditions/composite/and/evaluate.rq`
  (double-MINUS pattern), and updated the caption.

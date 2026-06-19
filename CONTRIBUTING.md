# Contributing

The most useful contribution is a new **framework module**: a regulation,
guidance, or interpretation encoded as declarative rules. Engine and
core-metamodel changes are welcome too, as issues or pull requests against
`src/parajudica/`.

## Add a framework module

A framework is a self-contained directory. Add yours under
`examples/frameworks/<name>/`:

```
examples/frameworks/<name>/
  framework.toml      # manifest
  model/<name>.ttl    # the ontology: labels, facets, rules
  rules/              # optional Jena rules
  constructs/         # optional SPARQL CONSTRUCT
  updates/            # optional SPARQL UPDATE
```

The manifest declares the module and the legal basis it rests on:

```toml
name = "<name>"
type = "privacy"
version = "1.0.0"
description = "One line on what this framework encodes"
depends_on = ["gdpr"]    # other modules it extends, optional

[legal]                  # what this encoding interprets, and on whose authority
jurisdiction = "EU"
authority = "European Medicines Agency"
instrument = "Regulation (EU) 2016/679 (GDPR)"
interpretation = "Risk-based disclosure; k >= 12 for public release."
citation = "EMA Policy 0070 (EMA/240810/2013)"
date = "2025-05"

[files]
model = ["model/<name>.ttl"]
```

The model's Turtle must declare an `owl:Ontology` header whose IRI is under
`https://parajudica.org/ns/framework/<name>`, with a `dcterms:title`. That IRI
is how the module is published and dereferenced.

The `[legal]` table is required for a framework module. An encoding is one
interpretation of a source, so cite the authority and instrument it rests on.
It also drives search and filtering in the registry.

## Publish

The build indexes every manifest automatically:

```bash
make site
```

Your module gets a dereferenceable IRI, an immutable version snapshot, and an
entry in the [registry](https://parajudica.org/registry). Open a pull request to
land it. To keep a module hosted yourself, open an issue and we can index it
instead.

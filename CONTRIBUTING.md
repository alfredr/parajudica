# Contributing

Contributions are welcome, especially **framework modules** modeling regulation, guidance, or interpretations thereof. Engine and core-metamodel changes are welcome too, as issues or pull requests against `src/parajudica/`.

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

The manifest declares the module and and targeted regulation:

```toml
name = "<name>"
type = "privacy"
version = "1.0.0"
description = "One line on what this framework encodes"
depends_on = ["gdpr"]    # other modules it extends, optional

[legal]                  
jurisdiction = "EU"
authority = "European Medicines Agency"
instrument = "Regulation (EU) 2016/679 (GDPR)"
interpretation = "Risk-based disclosure; k >= 12 for public release."
citation = "EMA Policy 0070 (EMA/240810/2013)"
date = "2025-05"

[files]
model = ["model/<name>.ttl"]
```

The model's Turtle must declare an `owl:Ontology` header whose IRI is under `https://parajudica.org/ns/framework/<name>`, with a `dcterms:title`, which is how the module is referenced.Moreover, the `[legal]` table is required for framework modules and drives discovery, search, and filtering.
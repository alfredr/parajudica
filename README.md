# Parajudica

A metamodel and fixed-point inference system for context-dependent data classification and multi-framework compliance.

## Overview

Parajudica enables context-dependent classification, allowing the same data to receive different compliance statuses depending on governance scope and available context. It provides multi-framework reasoning through a uniform representation of divergent regulatory requirements, including GDPR, HIPAA, EMA, and the Italian DPA.

The system uses fixed-point inference to propagate compliance labels through container hierarchies and joinable relationships. Framework-specific rules are expressed declaratively for implication, conditional implication, and propagation. Built-in k-anonymity analysis provides statistical de-identification checks with framework-specific thresholds.

## Project Structure

```
parajudica/
├── inference/
│   ├── metamodel/
│   │   ├── pj/              # Core ontology, rules, SPARQL constructs
│   │   └── sdc/             # Structured Data Containers extension
│   └── src/inference/       # Python inference engine
├── examples/
│   ├── frameworks/
│   │   ├── base/            # Common facets and labels
│   │   ├── hipaa/           # HIPAA Privacy Rule
│   │   ├── gdpr/            # GDPR
│   │   ├── ema/             # European Medicines Agency
│   │   └── italy/           # Italian DPA
│   ├── db/                  # Sample data (medical, employee, research)
│   └── challenges/          # Paper validation scenarios (1-5)
└── paper/                   # LaTeX source
```

## Core Concepts

The metamodel consists of a small set of components that work together. Data Containers represent hierarchical structures such as databases, tables, and fields, and are linked through containment relations. Governance Scopes describe the operational contexts in which compliance must be evaluated, such as a research or human resources environment. Facets capture properties of data that regulatory frameworks reason about, such as whether the data refers to individuals, healthcare information, or identifiable values. Labels are classifications that frameworks apply within scopes, including designations like PHI, PersonalData, or SpecialCategoryData. Frameworks themselves are represented as rule systems that declare how facets imply or propagate these labels.

Rules take several forms. Simple implication rules derive labels from the presence of certain facets, for example when data is both individual and healthcare-related, it is classified as PHI. Conditional implication rules require additional field-level checks before assigning a label, making them suitable for nuanced cases. Propagation rules specify how labels spread across relationships: downward from a parent container to its children, upward from children to their parent, horizontally between sibling containers, or across joinable relationships between tables.

The inference engine computes a fixed-point result starting from initial assertions. Jena rules are compiled into SPARQL CONSTRUCT queries and blank nodes are skolemized to ensure unique identifiers. The engine iteratively applies rules until no new assertions are produced, which typically requires fewer than ten rounds. This fixed-point procedure guarantees consistent classification across multiple frameworks and scopes, while remaining computationally efficient with polynomial complexity relative to the size of the system.

## Example: Healthcare Compliance Scenario

### Compliance Environment

The example models a healthcare organization with two databases across three governance scopes:

**Data Structures:**
- `MedicalDB` contains `PatientInfo`, `PatientEncounters`, and `PatientTreatments` tables
- `EmployeeDB` contains `ProvidersInfo` table
- `ResearchDB` contains `AggregatedHealth` (k=3) and `AggregatedHealth12` (k=12) tables

**Governance Scopes:**
- `MedicalGovernanceScope`: Clinical operations accessing medical tables only
- `HumanResourcesScope`: HR operations accessing employee tables only  
- `ResearchScope`: Research activities accessing all tables

**Joinable Relationships:**
- `PatientInfo` joinable with `PatientEncounters` (via patient ID)
- `PatientEncounters` joinable with `ProvidersInfo` (via provider ID)

**Initial Assertions:**
- `PatientInfo` has facets: Individual, Healthcare, DirectIdentifier
- `PatientEncounters` has facets: Individual, Healthcare
- `PatientTreatments` has facets: Individual, Healthcare
- `ProvidersInfo` has facets: Individual, DirectIdentifier
- `AggregatedHealth` has facets: OpenGroup, InternalIdentifier (k=3)

### Challenge 1: Context-Dependent Classification

The same data receives different compliance status based on governance scope. ProvidersInfo is classified as Individual data in HumanResourcesScope where only employee data is available, but becomes PHI in ResearchScope where it can be joined with patient data.

```
┏━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━┓
┃ scope               ┃ container      ┃ framework       ┃ label               ┃
┡━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━┩
│ :HumanResourcesSco… │ :ProvidersInfo │ :BaseFramework  │ :Individual         │
│ :HumanResourcesSco… │ :ProvidersInfo │ :GDPRFramework  │ :Individual         │
│ :ResearchScope      │ :ProvidersInfo │ :BaseFramework  │ :Individual         │
│ :ResearchScope      │ :ProvidersInfo │ :GDPRFramework  │ :Individual         │
│ :ResearchScope      │ :ProvidersInfo │ :HIPAAFramework │ :ProtectedHealthIn… │
└─────────────────────┴────────────────┴─────────────────┴─────────────────────┘
```

The propagation chain in ResearchScope works as follows: PatientInfo with identifiers in healthcare context becomes PHI, PatientEncounters joinable with PatientInfo inherits PHI, and ProvidersInfo joinable with PatientEncounters also inherits PHI.

### Challenge 2: Framework Divergence

Different frameworks classify the same joined data differently. HIPAA uses an expansive model where joined data inherits PHI status, while GDPR maintains field-level precision where data retains its original classification.

```
┏━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━┓
┃ scope             ┃ container         ┃ framework        ┃ label             ┃
┡━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━┩
│ :ResearchScope    │ :PatientTreatmen… │ :GDPRFramework   │ :PersonalData     │
│ :ResearchScope    │ :PatientTreatmen… │ :GDPRFramework   │ :SpecialCategory… │
│ :ResearchScope    │ :PatientTreatmen… │ :HIPAAFramework  │ :ProtectedHealth… │
│ :ResearchScope    │ :ProvidersInfo    │ :GDPRFramework   │ :PersonalData     │
│ :ResearchScope    │ :ProvidersInfo    │ :HIPAAFramework  │ :ProtectedHealth… │
└───────────────────┴───────────────────┴──────────────────┴───────────────────┘
```
(Selected rows shown. Full output includes MedicalGovernanceScope and additional base framework labels.)

ProvidersInfo under HIPAA receives PHI via joinable propagation, but under GDPR only gets PersonalData (not SpecialCategoryData). PatientTreatments is PHI under HIPAA but split into PersonalData and SpecialCategoryData under GDPR.

### Challenge 3: Propagation Semantics

Joinable relationships fundamentally affect compliance classification. With joinable relationships declared, ProvidersInfo inherits PHI status. Without them, it remains non-PHI.

```
# WITH joinable relationships:
┏━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓
┃ framework       ┃ label                       ┃
┡━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┩
│ :GDPRFramework  │ :PersonalData               │
│ :HIPAAFramework │ :ProtectedHealthInformation │
└─────────────────┴─────────────────────────────┘

# WITHOUT joinable relationships:
┏━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━┓
┃ framework      ┃ label         ┃
┡━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━┩
│ :GDPRFramework │ :PersonalData │
└────────────────┴───────────────┘
```

### Challenge 4: De-identification Standards

K-anonymity analysis with framework-specific thresholds shows how different standards evaluate re-identification risk. Tables with k<3 trigger HighReidentificationRisk under HIPAA Expert Determination.

```
┏━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━━━━━━━━━━━━━━━┓
┃ table              ┃ label                     ┃ kValue               ┃
┡━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━━━━━━━━━━━━━━━┩
│ :AggregatedHealth  │ :KAnonymityAnalysis       │ 3                    │
│ :PatientEncounters │ :HighReidentificationRisk │ (triggered by k < 3) │
│ :PatientEncounters │ :KAnonymityAnalysis       │ 1                    │
│ :PatientInfo       │ :HighReidentificationRisk │ (triggered by k < 3) │
│ :PatientInfo       │ :KAnonymityAnalysis       │ 1                    │
│ :ProvidersInfo     │ :HighReidentificationRisk │ (triggered by k < 3) │
│ :ProvidersInfo     │ :KAnonymityAnalysis       │ 1                    │
└────────────────────┴───────────────────────────┴──────────────────────┘
```

### Challenge 5: Framework Divergence Table

Reproduces the paper's comparison showing how identical k-anonymized data is evaluated differently across frameworks. A dataset with k=3 is acceptable under HIPAA but not under EMA or Italian DPA.

```
┏━━━━━━━━━━━━━━━━━━━━━┳━━━━━━━━┳━━━━━━━┳━━━━━┳━━━━━━━┓
┃ table               ┃ kValue ┃ hipaa ┃ ema ┃ italy ┃
┡━━━━━━━━━━━━━━━━━━━━━╇━━━━━━━━╇━━━━━━━╇━━━━━╇━━━━━━━┩
│ :AggregatedHealth   │ 3      │ YES   │ NO  │ NO    │
│ :AggregatedHealth12 │ 12     │ YES   │ YES │ NO    │
│ :PatientInfo        │ 1      │ NO    │ NO  │ NO    │
└─────────────────────┴────────┴───────┴─────┴───────┘
```

HIPAA Expert Determination accepts k>=3, EMA requires k>=12, and the Italian DPA rejects any dataset with unique identifiers that enable singling out, regardless of k value.

## Paper

The paper describing the metamodel and formalization is available in `paper/main.tex`. It presents the formal semantics of the system, explains fixed-point computation, and provides comparative analysis of regulatory frameworks. The paper also evaluates performance, documents implementation, and includes real-world validation scenarios.

## Quick Start

Installation can be done either with uv, the recommended method, or directly with pip. Once installed, the framework's challenges can be run through the provided Makefile. These challenges illustrate the main concepts: context-dependent classification, divergence between frameworks such as HIPAA and GDPR, the role of propagation semantics across hierarchical or joinable relationships, and standards for de-identification such as k-anonymity under different frameworks. Running all challenges together reproduces the comparisons described in the accompanying paper.

```bash
# Install dependencies with uv (recommended)
uv pip install -e .

# Or with pip
pip install -e .

# Run all challenges
make challenges
```

## Citation

```bibtex
@article{moreau2025parajudica,
  title={Parajudica: An RDF-Based Reasoner and Metamodel for Multi-Framework Context-Dependent Data Compliance Assessments},
  author={Moreau, Luc and Rossi, Alfred and Stalla-Bourdillon, Sophie},
  year={2025}
}
```
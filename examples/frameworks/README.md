# Compliance Frameworks

This directory contains the framework implementations for privacy and compliance reasoning.

## Overview

Each framework represents a specific regulatory or compliance perspective with its own rules for:
- Label derivation (what labels are created from other labels)
- Propagation behaviors (how labels spread between containers)
- Conditional rules (context-dependent classifications)

## Base Framework (`base-framework.ttl`)

The Base Framework provides foundational compliance concepts that are framework-agnostic:

### Key Concepts:
- **Domain Labels**: `Healthcare`, `Financial`, `Research` - represent business domains
- **Data Types**: Core data classifications like `Name`, `SocialSecurityNumber`, `TelephoneNumber`
- **Identifier Hierarchy**: 
  - `IdentifierData` (parent class)
  - `DirectIdentifierData` (SSN, Name, MRN)
  - `IndirectIdentifierData` (Age, Gender, ZipCode)

### Propagation Rules:
- **Healthcare Domain**: Propagates **Inward** (parent to children)
  - If a database is in Healthcare domain, all its tables inherit that context
  - Critical for HIPAA conditional rules that require Healthcare context

### Subclass Relationships:
- Direct identifiers → IdentifierData
- Indirect identifiers → IdentifierData
- Specific types (Name, SSN) → DirectIdentifierData

## GDPR Framework (`gdpr-framework.ttl`)

The General Data Protection Regulation framework implements EU privacy law concepts:

### Key Labels:
- **PersonalData**: Any data relating to an identified or identifiable individual
- **SpecialCategoryData**: Sensitive personal data requiring extra protection
- **HealthData**: Health-related data (subclass of SpecialCategoryData)

### Derivation Rules:
1. **PersonalData**: Triggered when:
   - Container has `Individual` label AND
   - Container CONTAINS `IdentifierData`

2. **HealthData**: Triggered when:
   - Container has medical codes (`DiagnosisCode`, `TreatmentCode`) AND
   - Container has `Healthcare` context AND
   - Container CONTAINS `IdentifierData`

3. **SpecialCategoryData**: Derived from:
   - `HealthData` (via subclass)
   - `BiometricData` (via subclass)

### Propagation:
- GDPR uses **Inward** propagation only
- PersonalData flows from database to tables
- No peer or joinable propagation (GDPR focuses on data itself, not relationships)

### Key Insight:
GDPR classification is based on the **nature of the data**, not its use context. Once data is PersonalData, it remains so regardless of de-identification efforts (unless true anonymization is achieved).

## Safe Harbor Framework (`safeharbor-framework.ttl`)

The Safe Harbor Framework implements HIPAA's Safe Harbor de-identification standard:

### Purpose:
Determines when data qualifies for HIPAA Safe Harbor exemption by checking for the 18 identifier types that must be removed.

### Safe Harbor Identifiers (18 types):
1. Names
2. Geographic subdivisions smaller than state
3. Dates (except year) related to individual
4. Telephone numbers
5. Fax numbers
6. Email addresses
7. Social Security numbers
8. Medical record numbers
9. Health plan beneficiary numbers
10. Account numbers
11. Certificate/license numbers
12. Vehicle identifiers
13. Device identifiers
14. Web URLs
15. IP addresses
16. Biometric identifiers
17. Full face photos
18. Any other unique identifying number

### Conditional Equivalence Rules:
Each Safe Harbor identifier type is triggered when:
- Base identifier exists (e.g., `Name`, `SocialSecurityNumber`)
- Container or parent has `Healthcare` context

Example:
```
IF container has Name AND container/parent has Healthcare
THEN container has SafeHarborIdentifier
```

### Interaction with HIPAA:
- `SafeHarborIdentifier` → `HIPAAIdentifier` (subclass)
- `HIPAAIdentifier` triggers `ProtectedHealthInformation` (PHI)
- Absence of all Safe Harbor identifiers enables de-identification

## HIPAA Framework (`hipaa-framework.ttl`)

The Health Insurance Portability and Accountability Act framework:

### Key Labels:
- **ProtectedHealthInformation (PHI)**: Health information that identifies an individual
- **HIPAAIdentifier**: Any identifier in healthcare context

### Trigger Rules:
PHI is triggered when container has `HIPAAIdentifier`

### Propagation:
- PHI uses **Outward** propagation (child to parent)
- PHI uses **Peer** propagation (between siblings)
- PHI uses **Joinable** propagation (across joinable tables)

### Key Insight:
HIPAA classification depends heavily on **context**. The same data can be:
- NOT PHI in occupational health context (no Healthcare domain)
- PHI when in clinical context (has Healthcare domain)

## Framework Interactions

The frameworks work together to provide comprehensive compliance analysis:

1. **Base** provides foundational labels and domain context
2. **SafeHarbor** identifies HIPAA-relevant identifiers in healthcare context
3. **HIPAA** uses SafeHarbor output to determine PHI status
4. **GDPR** independently classifies PersonalData based on EU standards

### Example Flow:
```
Name (Base) + Healthcare (Base)
  → SafeHarborIdentifier (SafeHarbor)
  → HIPAAIdentifier (HIPAA, via subclass)
  → ProtectedHealthInformation (HIPAA, via trigger)

Name (Base) + Individual (Base)
  → PersonalData (GDPR, via contains IdentifierData)
```

## Framework-Specific Propagation Rules

Each framework defines how its labels propagate between containers:

### Base Framework Propagation
- **Healthcare**: Inward (parent to children)
  - Ensures all tables in a healthcare database inherit the domain context

### HIPAA Framework Propagation  
- **ProtectedHealthInformation (PHI)**: 
  - Inward (database to tables)
  - Outward (tables to database)
  - Peer (between sibling tables)
  - Joinable (across joinable relationships)
- **HIPAAIdentifier**: Inward only
  
HIPAA uses aggressive propagation because PHI contamination spreads through data relationships.

### GDPR Framework Propagation
- **PersonalData**: Inward only
- **SpecialCategoryData**: Inward only  
- **HealthData**: Inward only

GDPR uses conservative propagation - labels flow down but not across, reflecting that GDPR focuses on the data itself rather than relationships.

## Safe Harbor Concept of Operation

The Safe Harbor framework implements HIPAA's de-identification standard (45 CFR 164.514(b)(2)) through conditional equivalence rules.

### How It Works

1. **Conditional Trigger**: Each of the 18 Safe Harbor identifier types (Name, SSN, etc.) becomes a SafeHarborIdentifier when:
   - The identifier exists on a container
   - The container or its parent has Healthcare context

2. **Chain Reaction**:
   ```
   Name + Healthcare → SafeHarborIdentifier (SafeHarbor)
   SafeHarborIdentifier → HIPAAIdentifier (via subclass)
   HIPAAIdentifier → triggers PHI (HIPAA trigger rule)
   ```

3. **De-identification**: If ALL 18 identifier types are removed:
   - No SafeHarborIdentifier is created
   - No HIPAAIdentifier exists
   - PHI is not triggered
   - Data is de-identified under Safe Harbor

### The 18 Safe Harbor Identifiers
1. Names
2. Geographic subdivisions smaller than state
3. Dates (except year) related to individual
4. Telephone numbers
5. Fax numbers
6. Email addresses
7. Social Security numbers
8. Medical record numbers
9. Health plan beneficiary numbers
10. Account numbers
11. Certificate/license numbers
12. Vehicle identifiers
13. Device identifiers
14. Web URLs
15. IP addresses
16. Biometric identifiers
17. Full face photos
18. Any unique identifying number

### Key Design Decisions

- **Gender is NOT a Safe Harbor identifier** (it's not one of the 18)
- **Age requires special handling** (only restricted if over 89)
- **Healthcare context is required** - same identifiers outside healthcare don't trigger Safe Harbor
- **All-or-nothing**: Must remove ALL 18 types for de-identification

## Testing Frameworks

Each framework can be tested independently or in combination:
```python
# Load HIPAA with Safe Harbor
self.schemas = with_frameworks("hipaa-safeharbor")

# Load multiple frameworks
self.schemas = with_frameworks("hipaa-safeharbor", "gdpr")

# Base framework is always loaded automatically
```

## Implementation Notes

1. Frameworks cannot create labels owned by other frameworks
2. Frameworks can react to any label from any framework
3. Conditional rules use `onRelation` to check parent context
4. Propagation uses `:propagationBehavior` property
5. Subclass relationships enable automatic derivation
6. Safe Harbor, Expert Determination and HIPAA are all in the same file (hipaa.ttl)
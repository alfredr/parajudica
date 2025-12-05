# Challenge 3: Propagation Semantics

## Overview
This challenge demonstrates propagation semantics in action by showing how removing joinable relationships breaks PHI propagation in HIPAA while GDPR remains unaffected.

## Demonstration Setup
Two scenarios using the same data but different relationship configurations:

### Scenario A: WITH Joinable Relationships (standard env.ttl)
- ProvidersInfo is joinable with PatientEncounters and PatientTreatments
- PatientEncounters has PHI (due to healthcare context and identifiers)
- PHI propagates to ProvidersInfo via HIPAA's joinable propagation

### Scenario B: WITHOUT Joinable Relationships (env-no-join.ttl)
- Same data but joinable relationships removed
- PatientEncounters still has PHI
- ProvidersInfo does NOT get PHI (no propagation path)

## Results

**With joinable relationships:**
- ProvidersInfo under HIPAA: ProtectedHealthInformation
- ProvidersInfo under GDPR: PersonalData

**Without joinable relationships:**
- ProvidersInfo under HIPAA: NO PHI label
- ProvidersInfo under GDPR: PersonalData (unchanged)

## Key Insights
1. HIPAA uses joinable propagation - PHI spreads through join relationships
2. GDPR uses inward-only propagation - no automatic spread to joined tables
3. The joinable relationship is essential for HIPAA's PHI propagation
4. GDPR classification is unaffected by joinable relationships

## Running the Test
```bash
make challenge3
```

The test runs inference twice with the same data but different environment configurations, clearly showing how joinable propagation works in practice.
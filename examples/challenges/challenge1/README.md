# Challenge 1: Context-Dependent Classification

## Overview
This challenge demonstrates how the same data (ProvidersInfo) can have different compliance classifications depending on the governance scope and what other data is available.

## Data Setup
Using the standard dataset with three governance scopes:

### Governance Scopes
- **MedicalGovernanceScope**: Contains MedicalDB (PatientInfo, PatientEncounters, PatientTreatments)
- **HumanResourcesScope**: Contains EmployeeDB (ProvidersInfo only)
- **ResearchScope**: Has access to both MedicalDB and EmployeeHealthDB

### Tables and Relationships
- **ProvidersInfo**: Employee health data with names, SSNs, NPIs (tagged as `base:Individual`)
- **PatientInfo**: Patient records with identifiers (tagged as `base:Healthcare` and `base:Individual`)
- **PatientEncounters**: Medical encounters with dates (tagged as `base:Healthcare` and `base:Individual`)
- **PatientTreatments**: Treatment records (tagged as `base:Healthcare`)
- **Joinable Relationships**: ProvidersInfo joinableWith PatientEncounters and PatientTreatments

## Inference Chain

### HumanResourcesScope (No PHI)
1. Only ProvidersInfo is available (no patient data in this scope)
2. ProvidersInfo has `base:Individual` tag which materializes as Individual label
3. **Result**: Individual only, NO Protected Health Information

### ResearchScope (PHI via Propagation)

**Step 1: PatientEncounters becomes PHI**
1. PatientEncounters has `base:Healthcare` and `base:Individual` tags
2. BaseFramework propagates Type facet (Individual) inward to fields
3. encounterDate fields inherit Individual + have Timestamp label
4. Timestamp is subclass of MomentData (base.ttl)
5. HIPAA rule: MomentData + Healthcare + Individual becomes HIPAAIdentifier
6. HIPAA rule: Healthcare data CONTAINING HIPAAIdentifier becomes PHI

**Step 2: PHI propagates to ProvidersInfo**
1. PatientEncounters has PHI status
2. ProvidersInfo is joinable with PatientEncounters
3. HIPAA PropJoin rule: PHI propagates through joinable relationships
4. **Result**: ProvidersInfo gets PHI status

## Summary
The same employee data becomes PHI in research context because:
- Dates in healthcare context are HIPAA identifiers (when relating to individuals)
- PHI status propagates through joinable relationships
- Data classification depends on what other data is available in the scope

## Running the Test
```bash
make challenge1
```

Expected output shows:
- HumanResourcesScope: `base:Individual` only
- ResearchScope: `base:Individual` AND `hipaa:ProtectedHealthInformation`
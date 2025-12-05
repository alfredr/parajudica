# Challenge 2: Framework Divergence

## Overview
This challenge demonstrates how HIPAA and GDPR classify the same joined data differently. HIPAA spreads PHI status eagerly through joins, while GDPR maintains field-level precision.

## Data Setup
Using the standard dataset with all frameworks in ResearchScope:

### Governance Scope
- **ResearchScope**: Has access to both MedicalDB and EmployeeDB
- Both HIPAA and GDPR frameworks evaluate the same data

### Tables and Relationships
- **ProvidersInfo**: Employee data with names, SSNs, NPIs (tagged as `base:Individual`)
- **PatientInfo**: Patient records with identifiers (tagged as `base:Healthcare` and `base:Individual`)
- **PatientTreatments**: Treatment records (tagged as `base:Healthcare`)
- **Joinable Relationships**: ProvidersInfo joinableWith PatientTreatments

## Framework Behaviors

### HIPAA Framework
1. PatientInfo has identifiers (names, MRN, etc.) in healthcare context
2. PatientInfo is joinable with PatientTreatments
3. PatientTreatments gets PHI via joinable propagation
4. ProvidersInfo is joinable with PatientTreatments
5. ProvidersInfo gets PHI via joinable propagation
6. **Result**: All ProvidersInfo fields become PHI

### GDPR Framework
1. PatientInfo has identifiers which are PersonalData
2. PatientTreatments has treatment codes which could be HealthData/SpecialCategoryData
3. ProvidersInfo has employee information which is PersonalData
4. GDPR does NOT propagate SpecialCategoryData through joins
5. **Result**: ProvidersInfo remains PersonalData only

## Divergence Explained
The frameworks differ fundamentally in their approach:
- **HIPAA**: Once data is joined with patient records, it all becomes PHI
- **GDPR**: Data retains its original classification based on its semantic content

This reflects regulatory differences:
- HIPAA treats joined datasets as part of the designated record set
- GDPR maintains distinctions between data about vs. data identifying individuals

## Running the Test
```bash
make challenge2
```

Expected output shows:
- PatientTreatments: PHI (HIPAA) and PersonalData (GDPR)
- ProvidersInfo: PHI (HIPAA) and PersonalData (GDPR)

Note that ProvidersInfo does NOT get SpecialCategoryData under GDPR, even though it gets PHI under HIPAA.
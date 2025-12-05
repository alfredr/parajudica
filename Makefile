# Privacy Schema Examples
.PHONY: example debug-kanon challenge1 challenge2 challenge3 challenge4 challenges

# Common display options
DISPLAY_ARGS ?= --display-mode table --sort
VERBOSE ?= 1
# Cache is content-based: automatically invalidates when any input file changes
CACHE ?= --cache
# Set RM_CACHE=1 to force fresh computation (removes cache before running)
ifdef RM_CACHE
    CACHE += --rm-cache
endif

# Run full example with all frameworks and k-anonymity
example:
	uv run python -m inference.cli $(CACHE) \
		--frameworks examples/frameworks/base examples/frameworks/hipaa examples/frameworks/gdpr \
		--data examples/db/env.ttl examples/db/medical/*.ttl examples/db/employee/*.ttl \
		--display

# Challenge 1: Context-Dependent Classification
challenge1:
	@echo "=================================================="
	@echo "Challenge 1: Context-Dependent Classification"
	@echo "=================================================="
	@echo ""
	@echo "Dataset: Standard (all medical/employee tables, all frameworks, k-anonymity)"
	@echo ""
	@echo "Scenario: ProvidersInfo in different governance scopes"
	@echo "- HumanResourcesScope: Only ProvidersInfo available -> Individual, NOT PHI"
	@echo "- ResearchScope: Both medical and employee data available -> PHI via joinable propagation"
	@echo ""
	@echo "Propagation chain in ResearchScope:"
	@echo "  1. PatientInfo has identifiers in healthcare context -> PHI"
	@echo "  2. PatientEncounters joinable with PatientInfo -> PHI"
	@echo "  3. ProvidersInfo joinable with PatientEncounters -> PHI"
	@echo ""
	@echo "This demonstrates the same data has different compliance status"
	@echo "depending on what other data is available in that governance scope."
	@echo ""
	@uv run python -m inference.cli $(CACHE) \
		--frameworks examples/frameworks/base examples/frameworks/hipaa examples/frameworks/gdpr \
		--data examples/db/env.ttl examples/db/medical/*.ttl examples/db/employee/*.ttl \
		--query examples/challenges/challenge1/validate.rq \
		$(DISPLAY_ARGS) --verbose=$(VERBOSE)

# Challenge 2: Framework Divergence
challenge2:
	@echo "=================================================="
	@echo "Challenge 2: Framework Divergence"
	@echo "=================================================="
	@echo ""
	@echo "Dataset: Standard (all medical/employee tables, all frameworks)"
	@echo ""
	@echo "Scenario: ProvidersInfo and PatientTreatments in ResearchScope evaluated by both frameworks"
	@echo ""
	@echo "Expected results:"
	@echo "- ProvidersInfo under HIPAA: PHI (via joinable propagation)"
	@echo "- ProvidersInfo under GDPR: PersonalData only (no SpecialCategoryData propagation)"
	@echo "- PatientTreatments under HIPAA: PHI"
	@echo "- PatientTreatments under GDPR: PersonalData"
	@echo ""
	@echo "This demonstrates Framework Divergence:"
	@echo "- HIPAA: Expansive model where joined data inherits PHI status"
	@echo "- GDPR: Field-level precision where data retains original classification"
	@echo ""
	@echo "The divergence shows how identical data receives different compliance classifications under each framework"
	@echo ""
	@uv run python -m inference.cli $(CACHE) \
		--frameworks examples/frameworks/base examples/frameworks/hipaa examples/frameworks/gdpr \
		--data examples/db/env.ttl examples/db/medical/*.ttl examples/db/employee/*.ttl \
		--query examples/challenges/challenge2/validate.rq \
		$(DISPLAY_ARGS) --verbose=$(VERBOSE)

# Challenge 3: Propagation Semantics (Demonstration)
challenge3:
	@echo "=================================================="
	@echo "Challenge 3: Propagation Semantics - Joinable Propagation in Action"
	@echo "=================================================="
	@echo ""
	@echo "Scenario A: WITH joinable relationships (standard env.ttl)"
	@echo "Expected: ProvidersInfo gets PHI via joinable propagation from PatientEncounters"
	@echo ""
	@uv run python -m inference.cli $(CACHE) \
		--frameworks examples/frameworks/base examples/frameworks/hipaa examples/frameworks/gdpr \
		--data examples/db/env.ttl examples/db/medical/*.ttl examples/db/employee/*.ttl \
		--query examples/challenges/challenge3/validate.rq \
		$(DISPLAY_ARGS) --verbose=$(VERBOSE)
	@echo ""
	@echo "=================================================="
	@echo "Scenario B: WITHOUT joinable relationships (env-no-join.ttl)"
	@echo "Expected: ProvidersInfo has NO PHI (joinable propagation blocked)"
	@echo ""
	@uv run python -m inference.cli $(CACHE) \
		--frameworks examples/frameworks/base examples/frameworks/hipaa examples/frameworks/gdpr \
		--data examples/challenges/challenge3/env-no-join.ttl examples/db/medical/*.ttl examples/db/employee/*.ttl \
		--query examples/challenges/challenge3/validate.rq \
		$(DISPLAY_ARGS) --verbose=$(VERBOSE)

# Run all challenges
challenges: challenge1 challenge2 challenge3 challenge4 challenge5
	@echo ""
	@echo "=================================================="
	@echo "All challenges completed"
	@echo "=================================================="

# Challenge 4: De-identification Standards
challenge4:
	@echo "=================================================="
	@echo "Challenge 4: De-identification Standards"
	@echo "=================================================="
	@echo ""
	@echo "Dataset: Standard with k-anonymity analysis"
	@echo ""
	@echo "Demonstrates different de-identification approaches:"
	@echo "- K-anonymity analysis: Statistical measure of re-identification risk"
	@echo "- HIPAA Expert Determination: k < 3 triggers HighReidentificationRisk"
	@echo "- HIPAA Safe Harbor: Remove 18 identifiers (dates, names, etc.)"
	@echo "- Italy Framework: Focus on unique cardinality (UniqueID fields)"
	@echo ""
	@echo "Results show:"
	@echo "- AggregatedHealth: k=3 (NO high risk - Expert Determination considers this acceptable)"
	@echo "- PatientInfo/Encounters/Providers: k=1 (HIGH risk - unique identifiers present)"
	@echo ""
	@echo "Note: AggregatedHealth has internal UUID but k-anonymity excludes InternalIdentifiers"
	@echo ""
	@uv run python -m inference.cli $(CACHE) \
		--frameworks examples/frameworks/base examples/frameworks/hipaa examples/frameworks/gdpr examples/frameworks/ema examples/frameworks/italy \
		--data examples/db/env.ttl examples/db/medical/*.ttl examples/db/employee/*.ttl examples/db/research/*.ttl \
		--query examples/challenges/challenge4/validate.rq \
		--query examples/challenges/challenge4/control-status.rq \
		$(DISPLAY_ARGS) --verbose=$(VERBOSE)

# Challenge 5: Framework Divergence Table
challenge5:
	@echo "=================================================="
	@echo "Challenge 5: Framework Divergence (Paper Table 1)"
	@echo "=================================================="
	@echo ""
	@echo "Reproduces the paper's k-anonymity threshold comparison:"
	@echo "- HIPAA Expert Determination: k >= 3"
	@echo "- GDPR (EMA): k >= 12"
	@echo "- GDPR (Italian): Rejects any singling out"
	@echo ""
	@echo "Testing with:"
	@echo "- AggregatedHealth: k=3 with internal UUID"
	@echo "- AggregatedHealth12: k=12 with internal UUID"
	@echo ""
	@uv run python -m inference.cli $(CACHE) \
		--frameworks examples/frameworks/base examples/frameworks/hipaa examples/frameworks/gdpr examples/frameworks/ema examples/frameworks/italy \
		--data examples/db/env.ttl examples/db/medical/*.ttl examples/db/employee/*.ttl examples/db/research/*.ttl \
		--query examples/challenges/challenge5/framework-divergence.rq \
		$(DISPLAY_ARGS) --verbose=$(VERBOSE)
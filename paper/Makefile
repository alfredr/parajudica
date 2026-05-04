# Paper build targets
.PHONY: diagrams clean-diagrams pull-overleaf push-overleaf sync-status help

DIAGRAMS_DIR := diagrams
OVERLEAF_DIR := ../paper-overleaf
SYNC_FILES   := main.tex refs.bib llncs.cls splncs04.bst
DIAGRAM_SOURCES := $(wildcard $(DIAGRAMS_DIR)/*.mmd)
DIAGRAM_SVGS := $(DIAGRAM_SOURCES:.mmd=.svg)
DIAGRAM_PDFS := $(DIAGRAM_SOURCES:.mmd=.pdf)
DIAGRAM_PNGS := $(DIAGRAM_SOURCES:.mmd=.png)

# Build all diagram formats
diagrams: $(DIAGRAM_SVGS) $(DIAGRAM_PDFS) $(DIAGRAM_PNGS)

# Convert .mmd to .svg via mermaid.ink API
$(DIAGRAMS_DIR)/%.svg: $(DIAGRAMS_DIR)/%.mmd
	@echo "Building $@..."
	@curl -s "https://mermaid.ink/svg/$$(cat $< | base64 -w0)" > $@

# Convert .mmd to .png via mermaid.ink API
$(DIAGRAMS_DIR)/%.png: $(DIAGRAMS_DIR)/%.mmd
	@echo "Building $@..."
	@curl -s "https://mermaid.ink/img/$$(cat $< | base64 -w0)" > $@

# Convert .svg to .pdf via inkscape
$(DIAGRAMS_DIR)/%.pdf: $(DIAGRAMS_DIR)/%.svg
	@echo "Converting $< to PDF..."
	@inkscape $< --export-type=pdf --export-filename=$@ 2>/dev/null || echo "Warning: PDF may have missing text"

# Convert .svg to .eps via inkscape
$(DIAGRAMS_DIR)/%.eps: $(DIAGRAMS_DIR)/%.svg
	@echo "Converting $< to EPS..."
	@inkscape $< --export-type=eps --export-filename=$@ 2>/dev/null

clean-diagrams:
	rm -f $(DIAGRAMS_DIR)/*.svg $(DIAGRAMS_DIR)/*.pdf $(DIAGRAMS_DIR)/*.png $(DIAGRAMS_DIR)/*.eps

# Pull coauthor edits from Overleaf into paper/
# After this, run `git add paper-overleaf` in the repo root to bump the gitlink.
pull-overleaf:
	@if [ ! -e $(OVERLEAF_DIR)/.git ]; then \
		echo "Submodule missing; run: git submodule update --init paper-overleaf"; exit 1; \
	fi
	@git -C $(OVERLEAF_DIR) pull --ff-only
	@changed=0; for f in $(SYNC_FILES); do \
		if [ ! -f $(OVERLEAF_DIR)/$$f ]; then echo "missing in overleaf: $$f"; continue; fi; \
		if ! cmp -s $(OVERLEAF_DIR)/$$f $$f; then \
			echo "  updating $$f"; cp $(OVERLEAF_DIR)/$$f $$f; changed=1; \
		fi; \
	done; \
	if [ $$changed -eq 0 ]; then echo "  paper/ already up to date"; fi

# Push paper/ edits up to Overleaf. Usage: make push-overleaf MSG="..."
push-overleaf:
	@if [ -z "$(MSG)" ]; then \
		echo "Usage: make push-overleaf MSG=\"commit message\""; exit 1; \
	fi
	@if [ ! -e $(OVERLEAF_DIR)/.git ]; then \
		echo "Submodule missing; run: git submodule update --init paper-overleaf"; exit 1; \
	fi
	@for f in $(SYNC_FILES); do cp $$f $(OVERLEAF_DIR)/$$f; done
	@cd $(OVERLEAF_DIR) && git add $(SYNC_FILES) && \
		if git diff --cached --quiet; then \
			echo "  no changes to push"; \
		else \
			git commit -m "$(MSG)" && git push; \
		fi

# Show drift between paper/ and paper-overleaf/
sync-status:
	@echo "=== paper/ vs paper-overleaf/ ==="
	@for f in $(SYNC_FILES); do \
		if [ ! -f $(OVERLEAF_DIR)/$$f ]; then \
			printf "  MISSING  %s (in overleaf)\n" $$f; \
		elif cmp -s $$f $(OVERLEAF_DIR)/$$f; then \
			printf "  same     %s\n" $$f; \
		else \
			printf "  DIFFERS  %s\n" $$f; \
		fi; \
	done
	@echo ""
	@echo "=== submodule git status (paper-overleaf) ==="
	@git -C $(OVERLEAF_DIR) status -sb
	@echo ""
	@echo "=== local paper/ git status ==="
	@git -C .. status -s -- paper/

# Help
help:
	@echo "Targets:"
	@echo "  diagrams              - Build all diagrams (SVG, PDF, PNG)"
	@echo "  clean-diagrams        - Remove generated diagram files"
	@echo "  pull-overleaf         - Fetch Overleaf edits, copy into paper/"
	@echo "  push-overleaf MSG=... - Copy paper/ files into submodule, commit, push"
	@echo "  sync-status           - Show drift between paper/ and paper-overleaf/"

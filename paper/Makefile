# Paper build targets
.PHONY: diagrams clean-diagrams

DIAGRAMS_DIR := diagrams
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

# Help
help:
	@echo "Targets:"
	@echo "  diagrams       - Build all diagrams (SVG, PDF, PNG)"
	@echo "  clean-diagrams - Remove generated diagram files"

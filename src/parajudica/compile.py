#!/usr/bin/env python3
"""CLI for compiling Jena rules to SPARQL."""

import argparse
import sys
from pathlib import Path

from .jena_compiler import JenaToSPARQLCompiler


def main():
    """Compile Jena rules to SPARQL and display the result."""
    parser = argparse.ArgumentParser(description="Compile Jena rules to SPARQL CONSTRUCT queries")

    parser.add_argument("rule_file", help="Path to Jena rules file (.rules)")

    parser.add_argument("--output", "-o", help="Output file for compiled SPARQL (default: stdout)")

    parser.add_argument(
        "--separate", action="store_true", help="Output each rule as a separate SPARQL query"
    )

    parser.add_argument(
        "--verbose", "-v", action="store_true", help="Include rule names and comments in output"
    )

    args = parser.parse_args()

    rules_path = Path(args.rule_file)
    if not rules_path.exists():
        print(f"Error: File not found: {args.rule_file}", file=sys.stderr)
        sys.exit(1)

    rules_content = rules_path.read_text(encoding="utf-8")

    # Compile rules
    compiler = JenaToSPARQLCompiler()

    try:
        if args.separate:
            # Compile each rule separately
            sparql_queries = compiler.compile_rules_content(rules_content)
            output_lines = []

            if args.verbose:
                output_lines.append(f"# Compiled from: {args.rule_file}")
                output_lines.append(f"# Number of rules: {len(sparql_queries)}")
                output_lines.append("")

            for i, sparql in enumerate(sparql_queries, 1):
                if args.verbose:
                    output_lines.append(f"# === Rule {i} ===")
                output_lines.append(sparql)
                output_lines.append("")  # Empty line between rules

            output = "\n".join(output_lines)
        else:
            # Compile all rules together (return them as separate queries)
            sparql_queries = compiler.compile_rules_content(rules_content)

            if args.verbose:
                output = f"# Compiled from: {args.rule_file}\n"
                output += f"# Number of rules: {len(sparql_queries)}\n\n"
                output += "\n\n".join(sparql_queries)
            else:
                output = "\n\n".join(sparql_queries)

    except Exception as e:
        print(f"Error compiling rules: {e}", file=sys.stderr)
        sys.exit(1)

    # Output result
    if args.output:
        output_path = Path(args.output)
        output_path.write_text(output, encoding="utf-8")
        print(f"Compiled SPARQL written to: {args.output}", file=sys.stderr)
    else:
        print(output)


if __name__ == "__main__":
    main()

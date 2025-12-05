#!/usr/bin/env python3
"""
Rule engine that executes SPARQL CONSTRUCT rules iteratively using Oxigraph.
This provides rule-based reasoning without needing Jena.
"""

import json
import re
import time
from io import BytesIO
from pathlib import Path
from typing import Any

import pyoxigraph
from pyoxigraph import Quad, RdfFormat

from .jena_compiler import JenaToSPARQLCompiler


class OxigraphRuleEngine:
    """Execute SPARQL CONSTRUCT rules using Oxigraph"""

    def __init__(
        self,
        compiler: JenaToSPARQLCompiler | None = None,
        verbose: int = 0,
        debug_diff: bool = False,
    ):
        """Initialize the rule engine with an in-memory Oxigraph store.

        Args:
            compiler: Optional JenaToSPARQLCompiler instance. Creates one if not provided.
            verbose: Verbose level (0=quiet, 1=progress, 2=detailed, 3=include SPARQL)
            debug_diff: If True, show new triples added each round
        """
        self.compiler = compiler or JenaToSPARQLCompiler()
        self.iteration_limit = 100  # Increased iteration limit
        self.verbose = verbose
        self.debug_diff = debug_diff
        self.reset()

    def reset(self) -> None:
        """Clear the store and reset to initial state."""
        self.store = pyoxigraph.Store()
        self._compiled_cache: dict[str, list[str]] = {}
        if self.debug_diff:
            self._last_round_triples: set[str] = set()

    def load_ttl(self, content: bytes, base_iri: str | None = None) -> None:
        """Load TTL content into Oxigraph store.

        Args:
            content: TTL content as bytes
            base_iri: Optional base IRI for relative URIs
        """
        self.store.load(BytesIO(content), RdfFormat.TURTLE, base_iri=base_iri)

    def count_triples(self) -> int:
        """Count the total number of triples in the store."""
        return len(self.store)

    def _get_triple_strings(self) -> set[str]:
        """Get all triples as a set of strings for comparison."""
        triple_strings = set()
        for quad in self.store:
            # Convert quad to string (s p o)
            s = str(quad.subject)
            p = str(quad.predicate)
            o = str(quad.object)
            triple_strings.add(f"{s} {p} {o}")
        return triple_strings

    def compile_rules(self, rules_content: str) -> list[str]:
        """Compile Jena rules content to SPARQL queries.

        Args:
            rules_content: Jena rules as string

        Returns:
            List of SPARQL CONSTRUCT queries
        """
        return self.compiler.compile_rules_content(rules_content)

    def apply_query(self, sparql: str) -> tuple[int, float]:
        """Execute single SPARQL CONSTRUCT query and return number of new triples added.

        Args:
            sparql: SPARQL CONSTRUCT query

        Returns:
            Number of new triples added
        """
        if self.verbose >= 3:
            print(f"\n=== Executing SPARQL Query ===")
            print(sparql)
            print("=" * 40)

        start_time = time.perf_counter()
        results = self.store.query(sparql)

        count = 0
        if hasattr(results, "__iter__"):
            before_count = len(self.store)
            for triple in results:
                self.store.add(Quad(triple.subject, triple.predicate, triple.object))
            count = len(self.store) - before_count

        elapsed = time.perf_counter() - start_time
        return count, elapsed

    def apply_update(self, sparql: str) -> bool:
        """Execute SPARQL UPDATE query (DELETE/INSERT).

        Args:
            sparql: SPARQL UPDATE query

        Returns:
            True if successful, False otherwise
        """
        try:
            self.store.update(sparql)
            return True
        except Exception as e:
            print(f"Update error: {e}")
            return False

    def run_to_convergence(
        self, queries: list[str], max_iterations: int | None = None
    ) -> dict[str, Any]:
        """Run queries iteratively until no new facts are created.

        Args:
            queries: List of SPARQL CONSTRUCT queries
            max_iterations: Maximum iterations (default from self.iteration_limit)

        Returns:
            Statistics dictionary
        """
        if max_iterations is None:
            max_iterations = self.iteration_limit

        iteration = 0
        total_new_triples = 0
        iteration_stats = []

        # Track store size for convergence detection
        previous_count = self.count_triples()
        actual_new = 0  # Initialize to handle edge cases

        # Initialize triple tracking for debug-diff
        if self.debug_diff:
            self._last_round_triples = self._get_triple_strings()

        while iteration < max_iterations:
            iteration += 1
            new_in_iteration = 0

            # Apply all queries once
            for i, query in enumerate(queries):
                if self.verbose >= 2:
                    print(f"\n--- Query {i + 1}/{len(queries)} in iteration {iteration} ---")
                new_triples, elapsed = self.apply_query(query)
                new_in_iteration += new_triples
                if self.verbose >= 2:
                    print(f"Added {new_triples} new triples in {elapsed:.3f}s")

            current_count = self.count_triples()
            actual_new = current_count - previous_count

            # Show diff if debug-diff is enabled
            if self.debug_diff and actual_new > 0:
                current_triples = self._get_triple_strings()
                new_triples = current_triples - self._last_round_triples
                print(
                    f"\n=== New triples in iteration {iteration} ({len(new_triples)} total) ===",
                    flush=True,
                )
                for triple in sorted(new_triples)[:20]:  # Show first 20
                    print(f"  + {triple}", flush=True)
                if len(new_triples) > 20:
                    print(f"  ... and {len(new_triples) - 20} more", flush=True)
                self._last_round_triples = current_triples

            iteration_stats.append(actual_new)
            total_new_triples += actual_new

            if actual_new == 0:
                break

            previous_count = current_count

        return {
            "iterations": iteration,
            "total_new_triples": total_new_triples,
            "final_triple_count": self.count_triples(),
            "iteration_stats": iteration_stats,
            "converged": actual_new == 0,
        }

    def query(self, sparql: str) -> str | None:
        """Execute a SPARQL query and return results as JSON string."""
        try:
            results = self.store.query(sparql)
            bindings = []

            var_pattern = r"\?(\w+)"
            potential_vars = re.findall(var_pattern, sparql)
            seen = set()
            vars = []
            for v in potential_vars:
                if v not in seen:
                    seen.add(v)
                    vars.append(v)

            if not hasattr(results, "__iter__"):
                return json.dumps({"results": {"bindings": []}})

            for solution in results:
                binding = {}
                for var_name in vars:
                    try:
                        value = solution[var_name]
                        if not value:
                            continue

                        if hasattr(value, "value"):
                            actual_value = value.value
                        else:
                            actual_value = str(value)

                        binding[var_name] = {
                            "type": "uri" if hasattr(value, "iri") else "literal",
                            "value": actual_value,
                        }
                    except KeyError:
                        pass
                if binding:
                    bindings.append(binding)

            return json.dumps({"results": {"bindings": bindings}})
        except Exception as e:
            print(f"Query error: {e}")
            return None

    def get_all_triples(self):
        """Yield all triples in the store.

        Yields:
            Tuples of (subject, predicate, object)
        """
        query = "CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }"
        results = self.store.query(query)

        if hasattr(results, "__iter__"):
            for triple in results:
                yield (triple.subject, triple.predicate, triple.object)

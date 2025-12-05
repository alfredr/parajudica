#!/usr/bin/env python3
"""
Comprehensive inference system that orchestrates Jena rules and SPARQL queries.
This system handles the full inference cycle including condition evaluation.
"""

import sys
import time
import tomllib
from dataclasses import dataclass, field
from enum import Enum
from pathlib import Path
from typing import Any, Iterator, Optional

from .jena_compiler import JenaToSPARQLCompiler
from .oxigraph_runner import OxigraphRuleEngine
from .skolemizer import BlankNodeSkolemizer


class FileKind(Enum):
    """Types of files that can be included in inference."""

    TTL_DATA = "ttl_data"
    JENA_RULES = "jena_rules"
    SPARQL_CONSTRUCT = "sparql_construct"
    SPARQL_UPDATE = "sparql_update"


class FrameworkType(Enum):
    """Types of frameworks in the system."""

    INTERNAL = "internal"  # Inference engine internals
    CORE = "core"  # Core metamodels (pj, sdc)
    PRIVACY = "privacy"  # Privacy frameworks
    CUSTOM = "custom"  # User-defined


class Operation(Enum):
    """Types of operations that can be logged."""

    RULES = "rules"
    CONSTRUCT = "CONSTRUCT"
    UPDATE = "UPDATE"


@dataclass
class ExecutionStats:
    """Statistics for a single execution."""

    name: str
    operation: Operation
    new_triples: int = 0
    elapsed_time: float = 0.0
    count: int = 0


class StatsTracker:
    """Tracks execution statistics for queries and rules."""

    def __init__(self):
        self.stats: dict[str, ExecutionStats] = {}
        self.total_time: float = 0.0
        self.total_triples: int = 0

    def record(self, name: str, operation: Operation, new_triples: int, elapsed: float):
        """Record execution statistics."""
        if name not in self.stats:
            self.stats[name] = ExecutionStats(name=name, operation=operation)

        stat = self.stats[name]
        stat.count += 1
        stat.elapsed_time += elapsed
        stat.new_triples += new_triples

        self.total_time += elapsed
        if operation != Operation.UPDATE:
            self.total_triples += new_triples

    def get_sorted_stats(self) -> list[tuple[str, ExecutionStats]]:
        """Get statistics sorted by total execution time."""
        return sorted(self.stats.items(), key=lambda x: x[1].elapsed_time, reverse=True)


@dataclass
class IncludedFile:
    """Represents a file included in the inference system."""

    path: Path
    kind: FileKind
    content: str | bytes  # str for text files, bytes for TTL
    compiled: Any = None
    name: str = ""
    display_path: str = ""

    def __post_init__(self):
        if not self.name:
            self.name = self.path.name
        if not self.display_path:
            self.display_path = self.name


@dataclass
class Framework:
    """Represents a complete framework package."""

    name: str
    path: Path
    type: FrameworkType
    version: str = "1.0.0"
    description: str = ""
    depends_on: list[str] = field(default_factory=list)
    files: dict[FileKind, list[IncludedFile]] = field(default_factory=dict)

    @classmethod
    def from_manifest(cls, path: Path, compiler: JenaToSPARQLCompiler) -> "Framework":
        """Load a framework from its manifest file."""
        manifest_path = path / "framework.toml"

        if not manifest_path.exists():
            return cls._from_directory(path, compiler)

        with open(manifest_path, "rb") as f:
            config = tomllib.load(f)

        framework = cls(
            name=config["name"],
            path=path,
            type=FrameworkType(config.get("type", "custom")),
            version=config.get("version", "1.0.0"),
            description=config.get("description", ""),
            depends_on=config.get("depends_on", []),
        )

        file_mappings = {
            "model": FileKind.TTL_DATA,
            "rules": FileKind.JENA_RULES,
            "constructs": FileKind.SPARQL_CONSTRUCT,
            "updates": FileKind.SPARQL_UPDATE,
        }

        files_config = config.get("files", {})
        for category, content in files_config.items():
            kind = file_mappings.get(category)
            if not kind:
                continue

            if isinstance(content, list):
                file_list = content
            elif isinstance(content, dict) and "files" in content:
                file_list = content["files"]
            else:
                continue

            for file_path in file_list:
                full_path = path / file_path
                if full_path.exists():
                    included = _load_and_prepare_file(
                        full_path, kind, compiler, path, framework.name
                    )
                    framework.files.setdefault(kind, []).append(included)

        return framework

    @classmethod
    def _from_directory(cls, path: Path, compiler: JenaToSPARQLCompiler) -> "Framework":
        """Load framework from directory structure without manifest."""
        name = path.name

        # Determine framework type based on path
        match ("metamodel" in path.parts, name, "examples/frameworks" in str(path)):
            case (True, "inference", _):
                framework_type = FrameworkType.INTERNAL
            case (True, _, _):
                framework_type = FrameworkType.CORE
            case (_, _, True):
                framework_type = FrameworkType.PRIVACY
            case _:
                framework_type = FrameworkType.CUSTOM

        framework = cls(
            name=name, path=path, type=framework_type, description=f"Auto-loaded {name} framework"
        )

        for ttl_path in path.rglob("*.ttl"):
            framework.files.setdefault(FileKind.TTL_DATA, []).append(
                _load_and_prepare_file(ttl_path, FileKind.TTL_DATA, compiler, path, name)
            )

        for rules_path in path.rglob("*.rules"):
            framework.files.setdefault(FileKind.JENA_RULES, []).append(
                _load_and_prepare_file(rules_path, FileKind.JENA_RULES, compiler, path, name)
            )

        for query_path in path.rglob("*.rq"):
            content = query_path.read_text(encoding="utf-8")
            kind = (
                FileKind.SPARQL_UPDATE
                if "UPDATE" in content or "DELETE" in content
                else FileKind.SPARQL_CONSTRUCT
            )

            framework.files.setdefault(kind, []).append(
                _load_and_prepare_file(query_path, kind, compiler, path, name)
            )

        return framework


def _truncate_display_path(display_path: str, max_length: int = 60) -> str:
    """Truncate long paths for display, keeping the most relevant parts."""
    if len(display_path) <= max_length:
        return display_path

    if ":" in display_path:
        framework_part, path_part = display_path.split(":", 1)
        path_parts = path_part.split("/")
        if len(path_parts) > 2:
            return f"{framework_part}:.../{'/'.join(path_parts[-2:])}"
    else:
        path_parts = display_path.split("/")
        if len(path_parts) > 3:
            return f".../{'/'.join(path_parts[-3:])}"

    return display_path


def _load_and_prepare_file(
    path: Path,
    kind: FileKind,
    compiler: JenaToSPARQLCompiler,
    framework_path: Optional[Path] = None,
    framework_name: Optional[str] = None,
) -> IncludedFile:
    """Load a file and prepare it based on its kind."""
    content: str | bytes
    if kind == FileKind.TTL_DATA:
        with open(path, "rb") as f:
            content = f.read()
    else:
        with open(path, "r", encoding="utf-8") as f:
            content = f.read()

    if framework_path and framework_name:
        rel_path = path.relative_to(framework_path)
        display_path = f"{framework_name}:{rel_path}"
    else:
        try:
            display_path = str(path.relative_to(Path.cwd()))
        except ValueError:
            display_path = str(path)

    display_path = _truncate_display_path(display_path)

    included = IncludedFile(path=path, kind=kind, content=content, display_path=display_path)

    if kind == FileKind.JENA_RULES:
        assert isinstance(content, str)
        included.compiled = compiler.compile_rules_content(content)
    elif kind in (FileKind.SPARQL_CONSTRUCT, FileKind.SPARQL_UPDATE):
        included.compiled = content

    return included


class StatsTracker:
    """Centralized statistics tracking for inference operations."""

    def __init__(self):
        self.stats: dict[str, ExecutionStats] = {}

    def record_execution(
        self, query_name: str, operation: Operation, new_triples: int, elapsed: float
    ) -> None:
        """Record execution statistics for a query or operation."""
        if query_name not in self.stats:
            self.stats[query_name] = ExecutionStats(
                name=query_name, operation=operation, new_triples=0, elapsed_time=0.0, count=0
            )

        stat = self.stats[query_name]
        stat.count += 1
        stat.elapsed_time += elapsed

        # Only track triples for non-UPDATE operations
        if operation != Operation.UPDATE:
            stat.new_triples += new_triples

    def get_summary_stats(self) -> tuple[float, int]:
        """Get total time and triples generated across all queries."""
        total_time = sum(stat.elapsed_time for stat in self.stats.values())
        total_triples = sum(stat.new_triples for stat in self.stats.values())
        return total_time, total_triples

    def get_sorted_stats(self) -> list[tuple[str, ExecutionStats]]:
        """Get stats sorted by total time descending."""
        return sorted(self.stats.items(), key=lambda x: x[1].elapsed_time, reverse=True)

    def clear(self) -> None:
        """Clear all statistics."""
        self.stats.clear()


class InferenceSystem:
    """
    Orchestrates rule-based inference combining Jena rules and SPARQL queries.

    This system:
    1. Loads internal and core frameworks automatically
    2. Allows loading of external privacy and custom frameworks
    3. Runs inference to convergence using all loaded frameworks
    4. Supports user data files (TTL)
    """

    def __init__(self, verbose: int = 0, debug_diff: bool = False, cache_enabled: bool = False):
        """
        Initialize the inference system.

        Args:
            verbose: Verbose level (0=quiet, 1=progress, 2=detailed, 3=include SPARQL)
            debug_diff: If True, show new triples added each round
            cache_enabled: If True, enable caching of inference results
        """
        self.verbose = verbose
        self.debug_diff = debug_diff
        self.cache_enabled = cache_enabled

        self.package_dir = Path(__file__).parent.parent.parent

        self.frameworks: list[Framework] = []

        self.data_files: list[str] = []

        self.additional_queries: list[tuple[str, str]] = []  # (query, name)
        self.update_queries: list[tuple[str, str]] = []  # (query, name)

        self.compiler = JenaToSPARQLCompiler()
        self.rule_engine = OxigraphRuleEngine(
            compiler=self.compiler, verbose=self.verbose, debug_diff=self.debug_diff
        )

        self.stats_tracker = StatsTracker()

        self._load_system_frameworks()

    def _load_system_frameworks(self):
        """Load required internal and core frameworks from metamodel/"""
        metamodel_path = self.package_dir / "metamodel"

        if not metamodel_path.exists():
            raise FileNotFoundError(f"Metamodel directory not found: {metamodel_path}")

        for framework_dir in metamodel_path.iterdir():
            if not framework_dir.is_dir():
                continue

            framework = Framework.from_manifest(framework_dir, self.compiler)

            if framework.type not in (FrameworkType.INTERNAL, FrameworkType.CORE):
                if framework.name == "inference":
                    framework.type = FrameworkType.INTERNAL
                else:
                    framework.type = FrameworkType.CORE

            self.frameworks.append(framework)
            self._log(
                f"Loaded {framework.type.value} framework: {framework.name} v{framework.version}"
            )

    def load_framework(self, path: str | Path):
        """
        Load an external framework.

        Args:
            path: Path to framework directory containing manifest.yaml
        """
        framework = Framework.from_manifest(Path(path), self.compiler)

        if framework.type in (FrameworkType.INTERNAL, FrameworkType.CORE):
            raise ValueError(f"External frameworks cannot be of type {framework.type.value}")

        for dep in framework.depends_on:
            if not self._framework_exists(dep):
                raise ValueError(f"Missing dependency: {dep}")

        self.frameworks.append(framework)
        self._log(f"Loaded {framework.type.value} framework: {framework.name} v{framework.version}")

    def load_data(self, files: list[str]):
        """
        Load user TTL data files.

        Args:
            files: List of paths to TTL files
        """
        self.data_files.extend(files)
        self._log(f"Loaded {len(files)} data files")

    def add_sparql_query(self, query: str, name: str | None = None):
        """
        Add a SPARQL CONSTRUCT query to execute during inference.

        Args:
            query: SPARQL CONSTRUCT query
            name: Optional name for the query
        """
        query_name = name or f"Query_{len(self.additional_queries)}"
        self.additional_queries.append((query, query_name))

    def add_sparql_update(self, query: str, name: str | None = None):
        """
        Add a SPARQL UPDATE query to execute during inference.

        Args:
            query: SPARQL UPDATE query (DELETE/INSERT)
            name: Optional name for the query
        """
        query_name = name or f"Update_{len(self.update_queries)}"
        self.update_queries.append((query, query_name))

    def _framework_exists(self, name: str) -> bool:
        """Check if a framework with given name is loaded."""
        return any(f.name == name for f in self.frameworks)

    def _get_framework(self, name: str) -> Framework | None:
        """Get a framework by name."""
        for f in self.frameworks:
            if f.name == name:
                return f
        return None

    def frameworks_by_type(self, framework_type: FrameworkType) -> Iterator[Framework]:
        """Get all frameworks of a specific type."""
        for framework in self.frameworks:
            if framework.type == framework_type:
                yield framework

    def get_ordered_frameworks(self) -> list[Framework]:
        """
        Get all frameworks in proper execution order.

        Order: INTERNAL → CORE → PRIVACY → CUSTOM
        Within each type, respects dependencies.
        """
        ordered = []

        for ftype in [
            FrameworkType.INTERNAL,
            FrameworkType.CORE,
            FrameworkType.PRIVACY,
            FrameworkType.CUSTOM,
        ]:
            frameworks_of_type = list(self.frameworks_by_type(ftype))
            ordered.extend(frameworks_of_type)

        return ordered

    def run_inference_round(self) -> bool:
        """
        Run a single round of inference (rules + SPARQL queries).

        Returns:
            True if another round is needed, False if converged
        """
        initial_count = self.rule_engine.count_triples() if self.verbose else 0
        total_new = 0

        for framework in self.get_ordered_frameworks():
            for kind, files in framework.files.items():
                for included_file in files:
                    result = self._process_included_file(included_file, framework.name)
                    if result is None:
                        continue

                    new_triples, operation, elapsed = result
                    total_new += new_triples

                    query_name = included_file.display_path
                    self.stats_tracker.record_execution(query_name, operation, new_triples, elapsed)
                    self._log_execution_with_time(query_name, operation, new_triples, elapsed)

        for query, query_name in self.additional_queries:
            new, elapsed = self.rule_engine.apply_query(query)
            total_new += new
            self.stats_tracker.record_execution(query_name, Operation.CONSTRUCT, new, elapsed)
            self._log_execution_with_time(query_name, Operation.CONSTRUCT, new, elapsed)

        for query, query_name in self.update_queries:
            start = time.perf_counter()
            self.rule_engine.apply_update(query)
            elapsed = time.perf_counter() - start
            self.stats_tracker.record_execution(query_name, Operation.UPDATE, 0, elapsed)
            self._log_execution_with_time(query_name, Operation.UPDATE, 0, elapsed)

        if self.verbose:
            final_count = self.rule_engine.count_triples()
            self._log(f"Added {final_count - initial_count} triples this round")

        return total_new > 0

    def _process_included_file(
        self, included: IncludedFile, framework_name: str
    ) -> tuple[int, Operation, float] | None:
        """Process a file and return (new_triples, operation, elapsed_time) or None to skip."""
        if included.kind == FileKind.TTL_DATA:
            return None

        start = time.perf_counter()

        if included.kind == FileKind.JENA_RULES:
            stats = self.rule_engine.run_to_convergence(included.compiled)
            elapsed = time.perf_counter() - start
            return (stats.get("total_new_triples", 0), Operation.RULES, elapsed)

        if included.kind == FileKind.SPARQL_CONSTRUCT:
            new, elapsed = self.rule_engine.apply_query(included.compiled)
            return (new, Operation.CONSTRUCT, elapsed)

        if included.kind == FileKind.SPARQL_UPDATE:
            self.rule_engine.apply_update(included.compiled)
            elapsed = time.perf_counter() - start
            return (0, Operation.UPDATE, elapsed)

        return None

    def _log_execution(self, name: str, operation: Operation, new_triples: int):
        """Log execution with consistent format."""
        if operation == Operation.UPDATE:
            self._log(f"Executed UPDATE: {name}")
        elif operation == Operation.RULES:
            self._log(f"Applied rules from {name}: {new_triples} new triples")
        else:
            self._log(f"Executed {operation.value} {name}: {new_triples} new triples")

    def _log_execution_with_time(
        self, name: str, operation: Operation, new_triples: int, elapsed: float
    ):
        """Log execution with timing information."""
        if self.verbose < 1:
            return

        if operation == Operation.UPDATE:
            self._log(f"Executed UPDATE {name}: {elapsed:.3f} sec")
        elif operation == Operation.RULES:
            self._log(f"Applied rules from {name}: {new_triples} new triples in {elapsed:.3f} sec")
        else:
            self._log(
                f"Executed {operation.value} {name}: {new_triples} new triples in {elapsed:.3f} sec"
            )

    def _log(self, message: str):
        """Log a message if verbose mode is enabled."""
        if self.verbose:
            print(message, file=sys.stderr, flush=True)

    def run_to_convergence(self, max_rounds: int = 10) -> dict[str, Any]:
        """
        Run inference rounds until convergence (no new facts).

        Args:
            max_rounds: Maximum number of rounds to prevent infinite loops

        Returns:
            Overall statistics about the inference process
        """
        overall_stats = {"rounds": 0, "converged": False}

        self._log("\n=== Starting Inference ===")

        for framework in self.get_ordered_frameworks():
            for included in framework.files.get(FileKind.TTL_DATA, []):
                base_iri = f"file://{included.path}"
                assert isinstance(included.content, bytes)
                self.rule_engine.load_ttl(included.content, base_iri=base_iri)
                self._log(f"Loaded {framework.name}/{included.name}")

        for file_path in self.data_files:
            with open(file_path, "rb") as f:
                content = f.read()
            self.rule_engine.load_ttl(content, base_iri=f"file://{file_path}")
            self._log(f"Loaded user data: {Path(file_path).name}")

        self._log("Skolemizing blank nodes...")

        skolemizer = BlankNodeSkolemizer(use_content_based=True)
        self.rule_engine.store = skolemizer.skolemize_store(self.rule_engine.store)

        self._log("Skolemization complete.")

        initial_count = self.rule_engine.count_triples()
        self._log(f"Initial triple count: {initial_count}")

        for round_num in range(1, max_rounds + 1):
            self._log(f"\n--- Round {round_num} ---")

            needs_another_round = self.run_inference_round()

            if not needs_another_round:
                overall_stats["converged"] = True
                overall_stats["rounds"] = round_num
                self._log(f"\n=== Converged after {round_num} rounds ===")
                break
        else:
            overall_stats["rounds"] = max_rounds
            self._log(f"\n=== Reached max rounds ({max_rounds}) ===")

        final_count = self.rule_engine.count_triples()
        self._log(f"Final triple count: {final_count}")

        if self.verbose >= 1 and self.stats_tracker.stats:
            self._print_stats_summary()

        return overall_stats

    def query(self, sparql: str) -> Any:
        """
        Execute a SPARQL query on the inferred data.

        Args:
            sparql: SPARQL query to execute

        Returns:
            Query results
        """
        return self.rule_engine.query(sparql)

    def export_graph(self, output_file: str):
        """
        Export the entire inferred graph to a file.

        Args:
            output_file: Path to output file
        """
        with open(output_file, "w", encoding="utf-8") as f:
            for subject, predicate, obj in self.rule_engine.get_all_triples():
                f.write(f"{subject} {predicate} {obj} .\n")

        self._log(f"Exported graph to: {output_file}")

    def load_cached_store(self, store):
        """
        Load a pre-computed store into the rule engine.

        Args:
            store: pyoxigraph Store to load
        """
        self.rule_engine.store = store
        self._log(f"Loaded cached store with {self.rule_engine.count_triples()} triples")

    def _print_stats_summary(self) -> None:
        """Print a summary of query statistics."""
        self._log("\n=== Query Timing Summary ===")

        sorted_stats = self.stats_tracker.get_sorted_stats()
        for name, stat in sorted_stats:
            avg_time = stat.elapsed_time / stat.count if stat.count > 0 else 0
            triples_info = f", {stat.new_triples} triples" if stat.new_triples > 0 else ""
            self._log(
                f"{name}: {stat.elapsed_time:.3f} sec total "
                f"({stat.count} calls, {avg_time:.3f} sec avg{triples_info})"
            )

        total_time, total_triples = self.stats_tracker.get_summary_stats()
        self._log(f"\nTotal query time: {total_time:.3f} sec")
        self._log(f"Total triples generated: {total_triples}")

    def get_store(self):
        """
        Get the current store from the rule engine.

        Returns:
            Current pyoxigraph Store
        """
        return self.rule_engine.store

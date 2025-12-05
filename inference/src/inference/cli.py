#!/usr/bin/env python3
"""CLI entry point for the inference system."""

import argparse
import json
import shutil
from pathlib import Path

from rich.console import Console
from rich.table import Table
from rich.tree import Tree

from .cache import CacheManager
from .engine import InferenceSystem

DEFAULT_COMPLIANCE_QUERY = """
PREFIX : <https://openprovenance.org/ns/parajudica#>
SELECT ?assertion ?container ?label ?scope ?framework WHERE {
    ?assertion a :ComplianceAssertion ;
              :assertedOn ?container ;
              :assertsLabel ?label ;
              :assertedInScope ?scope ;
              :assertedByFramework ?framework .
}
ORDER BY ?scope ?container ?framework ?label
"""


def create_argument_parser() -> argparse.ArgumentParser:
    """Create and configure the command-line argument parser."""
    parser = argparse.ArgumentParser(
        description="Run privacy schema inference with compiled Jena rules via Oxigraph",
    )

    parser.add_argument(
        "--frameworks",
        nargs="+",
        help=(
            "Framework directories to load "
            "(e.g., examples/frameworks/base examples/frameworks/hipaa)"
        ),
    )
    parser.add_argument("--data", nargs="+", required=True, help="Data files to process")
    parser.add_argument(
        "--query",
        action="append",
        help="SPARQL query file to execute after inference (can be repeated)",
    )
    parser.add_argument(
        "--construct",
        action="append",
        help="SPARQL CONSTRUCT query file to execute during inference (can be repeated)",
    )
    parser.add_argument(
        "--upsert",
        action="append",
        help=(
            "SPARQL UPDATE query file to execute during inference (DELETE/INSERT, can be repeated)"
        ),
    )
    parser.add_argument("--export", help="Export inferred graph to file")
    parser.add_argument(
        "--max-rounds",
        type=int,
        default=10,
        help="Maximum inference rounds (default: 10)",
    )
    parser.add_argument(
        "--verbose",
        type=int,
        nargs="?",
        const=1,  # Default level when --verbose is used without a value
        default=0,
        help="Verbose output level: 1=progress, 2=detailed, 3=include SPARQL queries (default: 0)",
    )
    parser.add_argument(
        "--display",
        action="store_true",
        help="Display structure with compliance labels after inference",
    )
    parser.add_argument(
        "--display-mode",
        choices=["forest", "tuples", "json", "table"],
        default="json",
        help=(
            "Display mode: 'forest' for tree view (only with --display), "
            "'tuples' for tuple format, 'table' for rich table, "
            "'json' for raw JSON (default: json)"
        ),
    )
    parser.add_argument(
        "--sort",
        action="store_true",
        help="Sort results when using --display-mode tuples",
    )
    parser.add_argument(
        "--debug-diff",
        action="store_true",
        help="Show the new triples added in each round (debugging)",
    )
    parser.add_argument(
        "--cache",
        action="store_true",
        help="Enable caching of inference results based on input file hashes",
    )
    parser.add_argument(
        "--cache-dir",
        default="/tmp",
        help="Directory for storing cached inference results (default: /tmp)",
    )
    parser.add_argument(
        "--rm-cache",
        action="store_true",
        help="Remove cache before running inference (forces fresh computation)",
    )

    return parser


def load_query_file(file_path: str) -> str:
    """Load query content from a file."""
    return Path(file_path).read_text(encoding="utf-8")


def load_queries(
    system: InferenceSystem,
    construct_files: list[str] | None,
    upsert_files: list[str] | None,
) -> None:
    """Load CONSTRUCT and UPDATE queries into the inference system."""
    if not construct_files and not upsert_files:
        return

    if construct_files:
        for query_file in construct_files:
            query_content = load_query_file(query_file)
            system.add_sparql_query(query_content, name=query_file)

    if upsert_files:
        for query_file in upsert_files:
            query_content = load_query_file(query_file)
            system.add_sparql_update(query_content, name=query_file)


def main() -> None:
    """CLI entry point for the inference system."""
    parser = create_argument_parser()
    args = parser.parse_args()

    system = _initialize_system(args)

    # Handle caching if enabled
    if args.cache:
        _run_with_cache(system, args)
    else:
        _run_inference(system, args)

    _handle_post_inference(system, args)


def _run_with_cache(system: InferenceSystem, args: argparse.Namespace) -> None:
    """Run inference with caching enabled.

    Args:
        system: Initialized inference system
        args: Command line arguments
    """
    cache_manager = CacheManager(cache_dir=args.cache_dir)

    if args.rm_cache:
        content_hash = cache_manager.compute_hash(system, args.data)
        cache_path = cache_manager.get_cache_path(content_hash)
        if cache_path.exists():
            if cache_path.is_dir():
                print(f"Removing cache directory: {cache_path}")
                shutil.rmtree(cache_path)
            else:
                print(f"Removing cache file: {cache_path}")
                cache_path.unlink()

    # Compute hash of all input files
    content_hash = cache_manager.compute_hash(system, args.data)
    cache_path = cache_manager.get_cache_path(content_hash)

    if args.verbose:
        print(f"Cache hash: {content_hash}")
        print(f"Cache path: {cache_path}")

    if cache_manager.cache_exists(content_hash):
        print(f"Loading from cache: {cache_path}")
        cached_store = cache_manager.load_store(content_hash)
        system.load_cached_store(cached_store)
        print("\nInference completed (loaded from cache)")
    else:
        print(f"Cache miss. Running inference...")
        # Run normal inference
        stats = system.run_to_convergence(max_rounds=args.max_rounds)
        print("\nInference completed:")
        print(f"  Rounds: {stats['rounds']}")
        print(f"  Converged: {stats['converged']}")

        # Save to cache
        saved_path = cache_manager.save_store(system.get_store(), content_hash)
        print(f"  Saved to cache: {saved_path}")


def _initialize_system(args: argparse.Namespace) -> InferenceSystem:
    """Initialize and configure the inference system."""
    system = InferenceSystem(
        verbose=args.verbose, debug_diff=args.debug_diff, cache_enabled=args.cache
    )

    if args.frameworks:
        for framework_path in args.frameworks:
            system.load_framework(framework_path)

    system.load_data(args.data)
    load_queries(system, args.construct, args.upsert)
    return system


def _run_inference(system: InferenceSystem, args: argparse.Namespace) -> None:
    """Run inference to convergence and display results."""
    stats = system.run_to_convergence(max_rounds=args.max_rounds)
    print("\nInference completed:")
    print(f"  Rounds: {stats['rounds']}")
    print(f"  Converged: {stats['converged']}")


def _handle_post_inference(system: InferenceSystem, args: argparse.Namespace) -> None:
    """Handle queries and export after inference."""
    if args.query:
        _process_query_files(system, args)
    elif args.display:
        _process_display_mode(system, args)

    if args.export:
        system.export_graph(args.export)
        print(f"\nExported to: {args.export}")


def _process_query_files(system: InferenceSystem, args: argparse.Namespace) -> None:
    """Process multiple query files."""
    for i, query_file in enumerate(args.query):
        if i > 0:
            print()
        print(f"\n=== Query: {query_file} ===")
        query_content = load_query_file(query_file)
        result = system.query(query_content)
        _display_query_results(result, args.display_mode, args.sort)


def _process_display_mode(system: InferenceSystem, args: argparse.Namespace) -> None:
    """Process display mode with default compliance query."""
    if args.display_mode == "json":
        args.display_mode = "forest"

    if args.display_mode == "forest":
        display_structure(system, verbose=args.verbose)
        return

    result = system.query(DEFAULT_COMPLIANCE_QUERY)
    _display_query_results(result, args.display_mode, args.sort)


def _display_query_results(
    result: str,
    display_mode: str,
    sort: bool = False,
) -> None:
    """Display query results based on mode."""
    print("\nQuery results:")
    if display_mode == "table":
        format_query_results(result, display_mode, sort=sort)
    else:
        formatted = format_query_results(result, display_mode, sort=sort)
        print(formatted)


def fragment(uri: str) -> str:
    """Extract fragment identifier from URI."""
    if not uri:
        return ""

    if uri.startswith("_:"):
        return uri[2:]

    if "#" in uri:
        return uri.split("#")[-1]

    if "/" in uri:
        return uri.split("/")[-1]

    return uri


def parse_query_results[T](result: str | None, extractor) -> list[T]:
    """Parse SPARQL query results.

    Args:
        result: Query result (string JSON or other format)
        extractor: Function to extract values from each binding

    Returns:
        List of extracted values
    """
    if not isinstance(result, str):
        return []

    data = json.loads(result)
    bindings = data.get("results", {}).get("bindings", [])
    return [extractor(binding) for binding in bindings]


def parse_binding_value(binding_value: dict[str, str]) -> str | int | float:
    """Parse a single binding value to appropriate Python type."""
    raw_val = binding_value["value"]
    value_type = binding_value.get("type", "")

    if value_type == "uri" or raw_val.startswith(("http://", "https://", "urn:")):
        return f":{fragment(raw_val)}"

    try:
        if "." not in raw_val:
            return int(raw_val)
        return float(raw_val)
    except (ValueError, TypeError):
        return raw_val


def extract_rows_from_bindings(bindings: list[dict], var_names: list[str]) -> list[list]:
    """Extract rows of values from SPARQL bindings."""
    rows = []
    for binding in bindings:
        values = [
            parse_binding_value(binding[var]) if var in binding else "null" for var in var_names
        ]
        rows.append(values)
    return rows


def format_as_tuples(rows: list[list]) -> str:
    """Format rows as tuple strings."""
    output = "Query Result Tuples\n"
    output += "-" * 40 + "\n"

    for values in rows:
        formatted_values = [
            str(v) if not isinstance(v, str) or not v.startswith(":") else v for v in values
        ]
        tuple_str = f"({', '.join(formatted_values)})"
        output += tuple_str + "\n"

    return output


def format_as_table(rows: list[list], var_names: list[str]) -> str:
    """Format rows as a rich table."""
    table = Table(title="Query Results")

    for var in var_names:
        table.add_column(var, style="cyan")

    for values in rows:
        str_values = [str(v) if not isinstance(v, str) else v for v in values]
        table.add_row(*str_values)

    console = Console()
    console.print(table)
    return ""


def format_query_results(result: str, display_mode: str = "json", *, sort: bool = False) -> str:
    """Format SPARQL query results based on display mode.

    Args:
        result: Raw JSON query result string
        display_mode: One of "json", "tuples", "table", or "forest"
        sort: Whether to sort results (applies to tuples and table modes)

    Returns:
        Formatted string based on display mode
    """
    match display_mode:
        case "json":
            return result
        case "tuples" | "table":
            data = json.loads(result)
            bindings = data.get("results", {}).get("bindings", [])
            if not bindings:
                return "No results"

            var_names = list(bindings[0].keys())
            rows = extract_rows_from_bindings(bindings, var_names)

            if sort:
                rows.sort()

            match display_mode:
                case "tuples":
                    return format_as_tuples(rows)
                case "table":
                    return format_as_table(rows, var_names)
        case _:
            return result


def _query_governance_scopes(system: InferenceSystem) -> list[tuple[str, str]]:
    """Query all governance scopes from the system."""
    scopes_query = """
    PREFIX : <https://openprovenance.org/ns/parajudica#>
    PREFIX rdfs: <http://www.w3.org/2000/01/rdf-schema#>

    SELECT ?scope ?comment WHERE {
        ?scope a :GovernanceScope .
        OPTIONAL { ?scope rdfs:comment ?comment }
    }
    ORDER BY ?scope
    """
    scopes_result = system.query(scopes_query)
    return parse_query_results(
        scopes_result,
        lambda b: (b["scope"]["value"], b.get("comment", {}).get("value", "")),
    )


def _query_containment_relationships(
    system: InferenceSystem,
) -> tuple[dict[str, list[str]], set[str]]:
    """Query all containment relationships from the system."""
    containment_query = """
    PREFIX : <https://openprovenance.org/ns/parajudica#>
    SELECT ?parent ?child WHERE {
        ?parent :contains ?child .
    }
    ORDER BY ?parent ?child
    """
    containment_result = system.query(containment_query)

    children: dict[str, list[str]] = {}
    all_containers = set()

    for row in parse_query_results(containment_result, lambda b: b):
        parent = fragment(row["parent"]["value"])
        child = fragment(row["child"]["value"])
        children.setdefault(parent, []).append(child)
        all_containers.update([parent, child])

    return children, all_containers


def _query_containers_by_scope(system: InferenceSystem) -> dict[str, set[str]]:
    """Query containers available in each scope."""
    availability_query = """
    PREFIX : <https://openprovenance.org/ns/parajudica#>
    SELECT ?container ?scope WHERE {
        ?container :availableInScope ?scope .
        ?scope a :GovernanceScope .
    }
    ORDER BY ?scope ?container
    """
    availability_result = system.query(availability_query)

    containers_by_scope: dict[str, set[str]] = {}
    for row in parse_query_results(availability_result, lambda b: b):
        container = fragment(row["container"]["value"])
        scope = row["scope"]["value"]
        containers_by_scope.setdefault(scope, set()).add(container)

    return containers_by_scope


def _query_assertions_by_scope(
    system: InferenceSystem,
) -> dict[str, dict[str, list[tuple[str, str, str, str]]]]:
    """Query all compliance assertions organized by scope."""
    assertions_query = """
    PREFIX : <https://openprovenance.org/ns/parajudica#>
    SELECT ?assertion ?container ?label ?framework ?scope WHERE {
        ?assertion a :ComplianceAssertion ;
                  :assertedOn ?container ;
                  :assertsLabel ?label ;
                  :assertedByFramework ?framework ;
                  :assertedInScope ?scope .
    }
    ORDER BY ?scope ?container ?label
    """
    assertions_result = system.query(assertions_query)

    assertions_by_scope: dict[str, dict[str, list[tuple[str, str, str, str]]]] = {}

    for row in parse_query_results(assertions_result, lambda b: b):
        assertion_uri = row["assertion"]["value"]
        container = fragment(row["container"]["value"])
        label = fragment(row["label"]["value"])

        if label == "Available":
            continue

        framework = fragment(row["framework"]["value"])
        scope = row["scope"]["value"]

        assertions_by_scope.setdefault(scope, {}).setdefault(container, []).append(
            (assertion_uri, label, framework, scope)
        )

    return assertions_by_scope


def _query_assertion_params(system: InferenceSystem) -> dict[str, list[tuple[str, str]]]:
    """Query parameters for assertions."""
    params_query = """
    PREFIX : <https://openprovenance.org/ns/parajudica#>
    SELECT ?assertion ?paramName ?paramValue WHERE {
        ?assertion :hasParameterValue ?param .
        ?param :parameterName ?paramName ;
               :parameterValue ?paramValue .
    }
    ORDER BY ?assertion ?paramName
    """
    params_result = system.query(params_query)

    params_by_assertion: dict[str, list[tuple[str, str]]] = {}

    for row in parse_query_results(params_result, lambda b: b):
        assertion_uri = row["assertion"]["value"]
        param_name = row["paramName"]["value"]
        param_value = row["paramValue"]["value"]
        params_by_assertion.setdefault(assertion_uri, []).append((param_name, param_value))

    return params_by_assertion


def _query_field_info(system: InferenceSystem) -> dict[str, tuple[str, str | None]]:
    """Query SDC field names and values."""
    field_query = """
    PREFIX sdc: <https://openprovenance.org/ns/facet/sdc#>
    SELECT ?field ?fieldName ?fieldValue WHERE {
        ?field sdc:fieldName ?fieldName .
        OPTIONAL { ?field sdc:fieldValue ?fieldValue }
    }
    ORDER BY ?field
    """
    field_result = system.query(field_query)

    field_info: dict[str, tuple[str, str | None]] = {}

    for row in parse_query_results(field_result, lambda b: b):
        field_uri = row["field"]["value"]
        field_name = row["fieldName"]["value"]
        field_value = row.get("fieldValue", {}).get("value")
        field_info[fragment(field_uri)] = (field_name, field_value)

    return field_info


def _find_root_containers(
    scope_containers: set[str],
    children: dict[str, list[str]],
) -> set[str]:
    """Find root containers in a scope."""
    roots = set()

    for container in scope_containers:
        has_parent_in_scope = any(
            container in child_list and parent in scope_containers
            for parent, child_list in children.items()
        )

        if not has_parent_in_scope:
            roots.add(container)

    return roots


def _add_container_to_tree(
    container_name: str,
    parent_node,
    scope_assertions: dict[str, list],
    children: dict[str, list[str]],
    field_info: dict[str, tuple[str, str | None]],
    params_by_assertion: dict[str, list[tuple[str, str]]],
    max_depth: int = 10,
    current_depth: int = 0,
) -> None:
    """Recursively add container and its children to tree."""
    if current_depth >= max_depth:
        parent_node.add(f"{container_name} ...")
        return

    display_name = _get_container_display_name(container_name, field_info)
    node = parent_node.add(display_name)

    if container_name in scope_assertions:
        _add_assertions_to_node(node, scope_assertions[container_name], params_by_assertion)

    for child in sorted(children.get(container_name, [])):
        _add_container_to_tree(
            child,
            node,
            scope_assertions,
            children,
            field_info,
            params_by_assertion,
            max_depth,
            current_depth + 1,
        )


def _get_container_display_name(
    container_name: str,
    field_info: dict[str, tuple[str, str | None]],
) -> str:
    """Get display name for a container."""
    if container_name not in field_info:
        return container_name

    field_name, field_value = field_info[container_name]
    if field_value:
        return f"{field_name}: {field_value} (sdc:Field)"
    return f"{field_name} (sdc:Field)"


def _add_assertions_to_node(
    node,
    assertions: list[tuple[str, str, str, str]],
    params_by_assertion: dict[str, list[tuple[str, str]]],
) -> None:
    """Add compliance assertions to a tree node."""
    assertions_node = node.add("ComplianceAssertions")

    for assertion_uri, label, framework, _ in sorted(assertions, key=lambda x: x[1]):
        display_text = _format_assertion_display(
            assertion_uri, label, framework, params_by_assertion
        )
        assertions_node.add(display_text)


def _format_assertion_display(
    assertion_uri: str,
    label: str,
    framework: str,
    params_by_assertion: dict[str, list[tuple[str, str]]],
) -> str:
    """Format assertion for display."""
    display_text = (
        f"{label} [{framework}]" if framework and framework != "ExternalFramework" else label
    )

    if assertion_uri in params_by_assertion:
        params = params_by_assertion[assertion_uri]
        param_str = ", ".join(f"{name}={value}" for name, value in params)
        display_text = f"{display_text} ({param_str})"

    return display_text


def display_structure(system: InferenceSystem, *, verbose: bool = False) -> None:
    """Display the data structure with compliance labels organized by governance scope.

    Shows full containment hierarchy with compliance labels.
    """
    console = Console()

    scopes = _query_governance_scopes(system)
    if not scopes:
        print("\nNo governance scopes found")
        return

    children, _ = _query_containment_relationships(system)
    containers_by_scope = _query_containers_by_scope(system)
    assertions_by_scope = _query_assertions_by_scope(system)
    params_by_assertion = _query_assertion_params(system)
    field_info = _query_field_info(system)

    console.print("\n[bold]Data Structure with Compliance Labels[/bold]\n")

    for scope_uri, comment in scopes:
        _display_scope_tree(
            console,
            scope_uri,
            comment,
            containers_by_scope,
            assertions_by_scope,
            children,
            field_info,
            params_by_assertion,
        )


def _display_scope_tree(
    console: Console,
    scope_uri: str,
    comment: str,
    containers_by_scope: dict[str, set[str]],
    assertions_by_scope: dict[str, dict[str, list]],
    children: dict[str, list[str]],
    field_info: dict[str, tuple[str, str | None]],
    params_by_assertion: dict[str, list[tuple[str, str]]],
) -> None:
    """Display tree for a single governance scope."""
    scope_name = fragment(scope_uri)
    tree = Tree(f"[bold blue]{scope_name}[/bold blue]" + (f" - {comment}" if comment else ""))

    scope_containers = containers_by_scope.get(scope_uri, set())
    scope_assertions = assertions_by_scope.get(scope_uri, {})
    roots = _find_root_containers(scope_containers, children)

    for root in sorted(roots):
        _add_container_to_tree(
            root,
            tree,
            scope_assertions,
            children,
            field_info,
            params_by_assertion,
        )

    console.print(tree)
    console.print()


if __name__ == "__main__":
    main()

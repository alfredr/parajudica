#!/usr/bin/env python3
"""
Compiler to convert Jena rules to SPARQL CONSTRUCT queries.
This allows us to apply rule-based reasoning using pure SPARQL,
which can be executed by any SPARQL engine including Oxigraph.
"""

import re
from typing import Any


class JenaToSPARQLCompiler:
    def __init__(self):
        self.prefixes = {
            "": "https://openprovenance.org/ns/parajudica#",
            "rdf": "http://www.w3.org/1999/02/22-rdf-syntax-ns#",
            "rdfs": "http://www.w3.org/2000/01/rdf-schema#",
            "owl": "http://www.w3.org/2002/07/owl#",
            "xsd": "http://www.w3.org/2001/XMLSchema#",
            "sdc": "https://openprovenance.org/ns/facet/sdc#",
            "app": "https://example.org/medical#",
        }
        self.rule_counter = 0
        self.temp_var_counter = 0

    def _format_value(self, value: str) -> str:
        """Format a value for use in SPARQL queries.

        Handles special cases like boolean literals and ensures
        proper SPARQL formatting.

        Args:
            value: The value to format

        Returns:
            The formatted value for SPARQL
        """
        # Handle boolean literals
        if value in ("<true>", "true"):
            return '"true"^^xsd:boolean'
        elif value in ("<false>", "false"):
            return '"false"^^xsd:boolean'

        # Return unchanged for other values
        # (variables, URIs, quoted strings, etc.)
        return value

    def parse_triple(self, triple_str: str) -> tuple[str, str, str]:
        """Parse a Jena triple pattern like (?s rdf:type ?o)"""
        triple_str = triple_str.strip()
        if triple_str.startswith("(") and triple_str.endswith(")"):
            triple_str = triple_str[1:-1]

        # Handle quoted strings with spaces
        parts: list[str] = []
        current: list[str] = []
        in_quotes: bool = False
        quote_char = None

        for char in triple_str:
            if char in ('"', "'") and not in_quotes:
                in_quotes = True
                quote_char = char
                current.append(char)
                continue

            if char == quote_char and in_quotes:
                in_quotes = False
                quote_char = None
                current.append(char)
                continue

            if char.isspace() and not in_quotes:
                if current:
                    parts.append("".join(current))
                    current = []
                continue

            current.append(char)

        if current:
            parts.append("".join(current))

        if len(parts) != 3:
            raise ValueError(f"Invalid triple pattern: {triple_str}")

        s, p, o = parts
        return (s, p, o)

    def parse_builtin(self, builtin_str: str) -> dict | None:
        """Parse Jena built-ins like greaterThan(?x, 18)"""
        # Handle nested parentheses
        match = re.match(r"(\w+)\((.*)\)$", builtin_str.strip())
        if not match:
            return None

        func_name = match.group(1)
        args_str = match.group(2)

        # Parse arguments (handle nested function calls)
        args = []
        current: list[str] = []
        paren_depth = 0
        in_quotes = False

        for char in args_str:
            if char == '"' and (not current or current[-1] != "\\"):
                in_quotes = not in_quotes
                current.append(char)
                continue

            if not in_quotes:
                if char == "(":
                    paren_depth += 1
                    current.append(char)
                    continue

                if char == ")":
                    paren_depth -= 1
                    current.append(char)
                    continue

                if char == "," and paren_depth == 0:
                    args.append("".join(current).strip())
                    current = []
                    continue

            current.append(char)

        if current:
            args.append("".join(current).strip())

        return {"function": func_name, "args": args}

    def compile_rule(self, rule: str) -> str | None:
        """Compile a single Jena rule to SPARQL CONSTRUCT"""
        # First, remove inline comments but preserve the structure
        lines = rule.split("\n")
        cleaned_lines = []
        for line in lines:
            if "#" not in line:
                cleaned_lines.append(line)
                continue

            comment_pos = line.find("#")
            # Simple check - if # appears after some non-whitespace, it's likely a comment
            before_hash = line[:comment_pos].strip()
            if before_hash:
                cleaned_lines.append(before_hash)

        rule = "\n".join(cleaned_lines).strip()
        if not rule:
            return None

        # Parse rule format: [ruleName: body -> head]
        # Use DOTALL flag to handle multiline rules
        match = re.match(r"\[([^:]*):(.+?)->\s*(.+?)\]", rule, re.DOTALL)
        if not match:
            return None

        rule_name = match.group(1).strip()
        body = match.group(2).strip()
        head = match.group(3).strip()

        # Parse body and head
        body_patterns = self.parse_body(body)
        head_patterns = self.parse_head(head)

        # Generate SPARQL
        sparql = self.generate_sparql(rule_name, body_patterns, head_patterns)
        return sparql

    def parse_body(self, body: str) -> list[dict[str, Any]]:
        """Parse rule body (antecedents)"""
        patterns: list[dict[str, Any]] = []

        # Split patterns - handle nested parentheses
        parts = []
        current: list[str] = []
        paren_depth = 0
        in_quotes = False

        for char in body:
            if char == '"' and (not current or current[-1] != "\\"):
                in_quotes = not in_quotes
            elif not in_quotes:
                if char == "(":
                    paren_depth += 1
                elif char == ")":
                    paren_depth -= 1

            current.append(char)

            if paren_depth == 0 and char == ")":
                parts.append("".join(current).strip())
                current = []

        if current:
            remaining = "".join(current).strip()
            if remaining:
                parts.append(remaining)

        for part in parts:
            part = part.strip()
            if not part:
                continue

            if part.startswith("("):
                # Triple pattern
                patterns.append({"type": "triple", "pattern": self.parse_triple(part)})
                continue

            builtin = self.parse_builtin(part)
            if builtin:
                patterns.append({"type": "builtin", "pattern": builtin})
                continue

            # Special built-ins that don't follow standard pattern
            if not part.startswith("noValue"):
                continue

            # noValue(?var predicate value) checks that ?var doesn't have that property
            match = re.match(r"noValue\((\??\w+)\s+(\S+)\s+(\S+)\)", part)
            if match:
                patterns.append(
                    {
                        "type": "not_exists",
                        "subject": match.group(1),
                        "predicate": match.group(2),
                        "object": match.group(3),
                    }
                )

        return patterns

    def parse_head(self, head: str) -> list[tuple[str, str, str]]:
        """Parse rule head (consequents)"""
        patterns: list[tuple[str, str, str]] = []

        # Split patterns - handle nested parentheses
        parts = []
        current: list[str] = []
        paren_depth = 0
        in_quotes = False

        for char in head:
            if char == '"' and (not current or current[-1] != "\\"):
                in_quotes = not in_quotes
            elif not in_quotes:
                if char == "(":
                    paren_depth += 1
                elif char == ")":
                    paren_depth -= 1

            current.append(char)

            if paren_depth == 0 and char == ")":
                parts.append("".join(current).strip())
                current = []

        for part in parts:
            part = part.strip()
            if not part or not part.startswith("("):
                continue
            patterns.append(self.parse_triple(part))

        return patterns

    def generate_sparql(
        self,
        rule_name: str,
        body_patterns: list[dict[str, Any]],
        head_patterns: list[tuple[str, str, str]],
    ) -> str:
        """Generate SPARQL CONSTRUCT from parsed rule"""

        # Build PREFIX declarations
        prefix_lines = []
        for prefix, uri in self.prefixes.items():
            if prefix:
                prefix_lines.append(f"PREFIX {prefix}: <{uri}>")
                continue
            prefix_lines.append(f"PREFIX : <{uri}>")

        # Build CONSTRUCT clause
        construct_lines = []
        for s, p, o in head_patterns:
            # Format special values
            o = self._format_value(o)
            construct_lines.append(f"    {s} {p} {o}")

        # Build WHERE clause
        where_lines = []
        filters = []
        not_exists = []
        binds = []

        for pattern in body_patterns:
            match pattern["type"]:
                case "triple":
                    s, p, o = pattern["pattern"]
                    # Format special values
                    o = self._format_value(o)
                    where_lines.append(f"    {s} {p} {o}")

                case "builtin":
                    builtin = pattern["pattern"]
                    sparql_expr = self.compile_builtin(builtin)
                    if not sparql_expr:
                        continue

                    # Handle multi-line results (like from makeSkolem)
                    # Split by newlines and process each line
                    lines = sparql_expr.strip().split("\n")
                    for line in lines:
                        line = line.strip()
                        if not line:
                            continue
                        if line.startswith("FILTER"):
                            filters.append(line)
                        elif line.startswith("BIND"):
                            binds.append(line)

                case "not_exists":
                    obj = pattern.get("object", "?__temp")
                    # Format special values
                    obj = self._format_value(obj)
                    not_exists.append(
                        f"FILTER(NOT EXISTS {{ {pattern['subject']} {pattern['predicate']} {obj} }})"
                    )

        # Combine all parts
        sparql = f"# Rule: {rule_name}\n"
        sparql += "\n".join(prefix_lines) + "\n\n"
        sparql += "CONSTRUCT {\n"
        sparql += " .\n".join(construct_lines)
        if construct_lines:
            sparql += " .\n"
        sparql += "}\n"
        sparql += "WHERE {\n"

        for line in where_lines:
            sparql += line + " .\n"

        for bind in binds:
            sparql += f"    {bind}\n"

        for filter_clause in filters:
            sparql += f"    {filter_clause}\n"

        for not_exists_clause in not_exists:
            sparql += f"    {not_exists_clause}\n"

        sparql += "}"

        return sparql

    def compile_builtin(self, builtin: dict) -> str:
        """Compile Jena built-ins to SPARQL expressions"""
        func_name = builtin["function"]
        args = builtin["args"]

        # Map Jena built-ins to SPARQL using match statement
        match func_name:
            # Special handling for noValue
            case "noValue":
                return self._compile_novalue(args)

            # Comparison operations
            case "greaterThan":
                return f"FILTER({args[0]} > {args[1]})"
            case "lessThan":
                return f"FILTER({args[0]} < {args[1]})"
            case "le":
                return f"FILTER({args[0]} <= {args[1]})"
            case "ge":
                return f"FILTER({args[0]} >= {args[1]})"
            case "equal":
                return f"FILTER({args[0]} = {args[1]})"
            case "notEqual":
                return f"FILTER({args[0]} != {args[1]})"

            # String operations
            case "regex":
                return f"FILTER(REGEX({args[0]}, {args[1]}))"
            case "strConcat":
                concat_args = ", ".join(args[:-1])
                result_var = args[-1]
                return f"BIND(CONCAT({concat_args}) AS {result_var})"
            case "uriConcat":
                concat_args = ", ".join(args[:-1])
                result_var = args[-1]
                return f"BIND(IRI(CONCAT({concat_args})) AS {result_var})"

            # Type checking
            case "isLiteral":
                return f"FILTER(isLiteral({args[0]}))"
            case "isURI":
                return f"FILTER(isIRI({args[0]}))"
            case "isBNode":
                return f"FILTER(isBlank({args[0]}))"
            case "notBNode":
                return f"FILTER(!isBlank({args[0]}))"

            # Math
            case "sum":
                return f"BIND(({args[0]} + {args[1]}) AS {args[2]})"
            case "difference":
                return f"BIND(({args[0]} - {args[1]}) AS {args[2]})"
            case "product":
                return f"BIND(({args[0]} * {args[1]}) AS {args[2]})"
            case "quotient":
                return f"BIND(({args[0]} / {args[1]}) AS {args[2]})"

            # Special
            case "now":
                return f"BIND(NOW() AS {args[0]})"
            case "makeTemp":
                return self._compile_maketemp(args[0])
            case "makeSkolem":
                return self._compile_makeskolem(args)

            # Special built-ins
            case "listContains":
                # listContains(?list, ?item) - check if item is in RDF list
                # This is complex in SPARQL, approximate with property path
                if len(args) >= 2:
                    return f"FILTER(EXISTS {{ {args[0]} rdf:rest*/rdf:first {args[1]} }})"
                return ""  # Invalid listContains - skip

            # Unknown builtin - return empty string to skip
            case _:
                return ""

    def _compile_novalue(self, args: list[str]) -> str:
        """Compile noValue built-in"""
        # noValue can have two forms:
        # noValue(?x, ?p) - checks if there's no triple (?x, ?p, *)
        # noValue(?x, ?p, ?v) - checks if there's no triple (?x, ?p, ?v)

        # Parse old-style single argument format (for backwards compatibility)
        if len(args) == 1:
            arg = args[0].strip()
            args = arg.split(None, 2)

        assert len(args) == 3

        # Three-argument form: noValue(?x, ?p, ?v)
        subj, pred, obj = args

        # Format special values
        obj = self._format_value(obj)

        # Default case - literal NOT EXISTS check
        return f"FILTER(NOT EXISTS {{ {subj} {pred} {obj} }})"

    def _compile_maketemp(self, var_name: str) -> str:
        """Compile makeTemp built-in"""
        # Create a blank node for temporary variables
        return f"BIND(BNODE() AS {var_name})"

    def _compile_makeskolem(self, args: list[str]) -> str:
        """Simplified makeSkolem - no more __id checking needed.

        Since all blank nodes are now skolemized during preprocessing,
        we can directly use STR() on any variable.
        """
        # Create a unique IRI based on the arguments
        # makeSkolem(?key, arg1, arg2, ...) -> BIND(IRI(CONCAT(...)) AS ?key)
        if len(args) <= 1:
            return f"BIND(BNODE() AS {args[0]})"

        # Build concatenation from arguments
        concat_parts = []

        for _i, arg in enumerate(args[1:], 1):
            if arg.startswith("?"):
                # Use STR to handle both URIs and literals
                # Blank nodes are now URIs so STR() works fine
                concat_parts.append(f"ENCODE_FOR_URI(STR({arg}))")
            elif arg.startswith('"') and arg.endswith('"'):
                # String literal - already safe
                concat_parts.append(arg)
            else:
                # Add quotes for literal strings
                concat_parts.append(f'"{arg}"')

        concat_expr = ', "_", '.join(concat_parts)
        return f'    BIND(IRI(CONCAT("urn:skolem:", {concat_expr})) AS {args[0]})'

    def compile_rules_content(self, content: str) -> list[str]:
        """Compile all rules from Jena rules content"""
        sparql_queries = []

        content = re.sub(r"/\*.*?\*/", "", content, flags=re.DOTALL)

        # Split into individual rules
        rules = []
        current_rule = []
        bracket_depth = 0

        for line in content.split("\n"):
            line = line.strip()
            if not line or line.startswith("#"):
                continue

            if "[" in line:
                bracket_depth += line.count("[")
            if "]" in line:
                bracket_depth -= line.count("]")

            current_rule.append(line)

            if bracket_depth != 0 or not current_rule:
                continue

            rule_text = "\n".join(current_rule)  # Preserve newlines
            if rule_text.strip():
                rules.append(rule_text)
            current_rule = []

        # Compile each rule
        for rule in rules:
            try:
                sparql = self.compile_rule(rule)
                if sparql:
                    sparql_queries.append(sparql)
            except Exception as e:
                raise RuntimeError(f"Error compiling rule: {e}\nRule: {rule[:100]}...") from e

        return sparql_queries

    def compile_rules_file(self, rules_file: str) -> list[str]:
        """Compile all rules from a Jena rules file"""
        with open(rules_file, encoding="utf-8") as f:
            content = f.read()
        return self.compile_rules_content(content)

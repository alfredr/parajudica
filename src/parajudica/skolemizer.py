"""
Preprocessing module to assign stable IDs to all blank nodes.
"""

import hashlib

from pyoxigraph import BlankNode, NamedNode, Quad, Store


class BlankNodeSkolemizer:
    """Systematically replace blank nodes with stable URIs."""

    def __init__(self, namespace: str = "urn:skolem:", use_content_based: bool = True):
        self.namespace = namespace
        self.use_content_based = use_content_based
        self.blank_to_uri: dict[str, str] = {}

    def skolemize_store(self, store: Store) -> Store:
        """
        Create a new store with all blank nodes replaced by stable URIs.

        This happens ONCE before any rules run.
        """
        new_store = Store()

        if self.use_content_based:
            self._generate_content_based_ids(store)
        else:
            # First pass: collect all blank nodes and generate stable IDs
            for quad in store:
                self._register_blank(quad.subject)
                self._register_blank(quad.object)

        # Rewrite all triples with skolem URIs
        for quad in store:
            new_subject = self._skolemize_term(quad.subject)
            new_object = self._skolemize_term(quad.object)

            new_store.add(Quad(new_subject, quad.predicate, new_object, quad.graph_name))

        return new_store

    def _generate_content_based_ids(self, store: Store):
        """Generate skolem IDs based on the properties of each blank node."""
        blank_signatures: dict[str, list[tuple[str, str]]] = {}

        # Collect all properties of each blank node
        for quad in store:
            if isinstance(quad.subject, BlankNode):
                blank_id = str(quad.subject)
                if blank_id not in blank_signatures:
                    blank_signatures[blank_id] = []
                blank_signatures[blank_id].append(
                    (str(quad.predicate), str(quad.object) if quad.object else "")
                )

            # Also check if blank node appears as object
            if isinstance(quad.object, BlankNode):
                blank_id = str(quad.object)
                if blank_id not in blank_signatures:
                    blank_signatures[blank_id] = []
                # Add reverse relation for better distinction
                blank_signatures[blank_id].append(
                    (
                        f"^{quad.predicate}",  # Reverse relation marker
                        str(quad.subject) if quad.subject else "",
                    )
                )

        # Generate stable IDs from signatures
        for blank_id, signature in blank_signatures.items():
            # Sort for consistency
            signature.sort()
            sig_str = ";".join([f"{p}={o}" for p, o in signature])
            stable_id = hashlib.sha256(sig_str.encode()).hexdigest()[:16]
            self.blank_to_uri[blank_id] = f"{self.namespace}content-{stable_id}"

    def _register_blank(self, term):
        """Register a blank node and generate its stable ID."""
        if not isinstance(term, BlankNode):
            return

        blank_id = str(term)
        if blank_id in self.blank_to_uri:
            return

        # Generate stable ID based on the blank node's original ID
        # This ensures consistency across runs
        stable_id = hashlib.sha256(blank_id.encode()).hexdigest()[:16]
        self.blank_to_uri[blank_id] = f"{self.namespace}{stable_id}"

    def _skolemize_term(self, term):
        """Replace blank node with its skolem URI."""
        if not isinstance(term, BlankNode):
            return term

        uri = self.blank_to_uri.get(str(term))
        if uri:
            return NamedNode(uri)
        # Fallback: generate on the fly if somehow missed
        self._register_blank(term)
        uri = self.blank_to_uri[str(term)]
        return NamedNode(uri)

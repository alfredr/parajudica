"""
Parajudica

An RDF-based reasoner and metamodel for multi-framework, context-dependent
data compliance assessments.
"""

from importlib.metadata import PackageNotFoundError
from importlib.metadata import version as _version

from .engine import InferenceSystem

try:
    # Single source of truth: the version declared in pyproject.toml.
    __version__ = _version("parajudica")
except PackageNotFoundError:  # running from a source tree without an install
    __version__ = "0.0.0+unknown"

__all__ = ["InferenceSystem"]

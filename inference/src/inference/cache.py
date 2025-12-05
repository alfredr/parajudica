#!/usr/bin/env python3
"""Cache management for inference results."""

import hashlib
import shutil
from pathlib import Path
from typing import TYPE_CHECKING

import pyoxigraph

if TYPE_CHECKING:
    from .engine import Framework, InferenceSystem


class CacheManager:
    """Manages caching of inference results based on content hashing."""

    def __init__(self, cache_dir: str = "/tmp"):
        """Initialize cache manager.

        Args:
            cache_dir: Directory for storing cached results
        """
        self.cache_dir = Path(cache_dir)
        self.cache_dir.mkdir(exist_ok=True, parents=True)

    def compute_hash(self, system: "InferenceSystem", data_files: list[str]) -> str:
        """Compute hash of all input files for cache key.

        Args:
            system: InferenceSystem with loaded frameworks
            data_files: List of user data files

        Returns:
            Hex digest of SHA-256 hash
        """
        hasher = hashlib.sha256()

        # Hash all frameworks in deterministic order
        for framework in system.get_ordered_frameworks():
            self._hash_framework(hasher, framework)

        # Hash user data files in sorted order
        for file_path in sorted(data_files):
            hasher.update(file_path.encode())
            with open(file_path, "rb") as f:
                hasher.update(f.read())

        # Hash additional queries and updates
        for query_info in system.additional_queries:
            hasher.update(query_info["query"].encode())
            hasher.update(query_info["name"].encode())

        for update_info in system.update_queries:
            hasher.update(update_info["query"].encode())
            hasher.update(update_info["name"].encode())

        return hasher.hexdigest()

    def _hash_framework(self, hasher, framework: "Framework") -> None:
        """Hash a framework's content.

        Args:
            hasher: Hash object to update
            framework: Framework to hash
        """
        # Hash framework metadata
        hasher.update(framework.name.encode())
        hasher.update(framework.type.value.encode())
        hasher.update(framework.version.encode())

        # Hash files by kind in deterministic order
        for kind in sorted(framework.files.keys(), key=lambda k: k.value):
            for included_file in sorted(framework.files[kind], key=lambda f: str(f.path)):
                hasher.update(str(included_file.path).encode())
                hasher.update(included_file.kind.value.encode())

                # Hash content
                if isinstance(included_file.content, bytes):
                    hasher.update(included_file.content)
                else:
                    hasher.update(included_file.content.encode())

    def get_cache_path(self, content_hash: str) -> Path:
        """Get cache file path for given hash.

        Args:
            content_hash: Hash of input content

        Returns:
            Path to cache file
        """
        return self.cache_dir / f"cache-{content_hash}.db"

    def cache_exists(self, content_hash: str) -> bool:
        """Check if cache exists for given hash.

        Args:
            content_hash: Hash of input content

        Returns:
            True if cache exists
        """
        cache_path = self.get_cache_path(content_hash)
        return cache_path.exists()

    def save_store(self, store: pyoxigraph.Store, content_hash: str) -> Path:
        """Save store to cache using pyoxigraph's native persistence.

        Args:
            store: In-memory store to save
            content_hash: Hash for cache key

        Returns:
            Path to saved cache
        """
        cache_path = self.get_cache_path(content_hash)
        temp_path = cache_path.with_suffix(".tmp")

        file_store = pyoxigraph.Store(str(temp_path))
        data = store.dump(format=pyoxigraph.RdfFormat.N_QUADS)
        file_store.load(data, format=pyoxigraph.RdfFormat.N_QUADS)
        del file_store
        temp_path.rename(cache_path)

        return cache_path

    def load_store(self, content_hash: str) -> pyoxigraph.Store:
        """Load store from cache.

        Args:
            content_hash: Hash for cache key

        Returns:
            Loaded store
        """
        cache_path = self.get_cache_path(content_hash)
        if not cache_path.exists():
            raise FileNotFoundError(f"Cache not found: {cache_path}")

        store = pyoxigraph.Store()
        file_store = pyoxigraph.Store(str(cache_path))
        data = file_store.dump(format=pyoxigraph.RdfFormat.N_QUADS)
        store.load(data, format=pyoxigraph.RdfFormat.N_QUADS)

        return store

    def clear_cache(self) -> None:
        """Clear all cached files."""
        if self.cache_dir.exists():
            shutil.rmtree(self.cache_dir)
            self.cache_dir.mkdir()

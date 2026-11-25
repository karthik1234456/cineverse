from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from sqlalchemy.ext.asyncio import AsyncSession


class CatalogProvider(ABC):
    """
    Abstract interface for Movie Catalog Providers.
    Allows seamlessly toggling between 'local' (seed/mock data) and 'tmdb' (real Indian release catalogue).
    """

    @property
    @abstractmethod
    def source_name(self) -> str:
        """Identifier for the source ('local' or 'tmdb')."""
        pass

    @abstractmethod
    async def get_movies(
        self,
        db: AsyncSession,
        city_id: Optional[int] = None,
        language: Optional[str] = None,
        genre: Optional[str] = None,
        format_filter: Optional[str] = None,
        status: Optional[str] = None,
        limit: int = 50,
    ) -> List[Dict[str, Any]]:
        """Retrieve movie listing for city / filters."""
        pass

    @abstractmethod
    async def get_movie_detail(
        self,
        db: AsyncSession,
        movie_id_or_slug: str,
    ) -> Optional[Dict[str, Any]]:
        """Retrieve detailed movie profile, cast, and trailers."""
        pass

    @abstractmethod
    async def sync_catalog(
        self,
        db: AsyncSession,
        languages: Optional[List[str]] = None,
        force_refresh: bool = False,
    ) -> Dict[str, Any]:
        """
        Synchronize releases into the database idempotently.
        Returns a summary report dict (movies_synced, languages_processed, errors).
        """
        pass


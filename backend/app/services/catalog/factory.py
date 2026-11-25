from app.config import settings
from app.services.catalog.base import CatalogProvider
from app.services.catalog.local import LocalCatalogProvider
from app.services.catalog.tmdb import TMDBCatalogProvider

_local_provider = LocalCatalogProvider()
_tmdb_provider = TMDBCatalogProvider()


def get_catalog_provider() -> CatalogProvider:
    """
    Returns the configured CatalogProvider:
    - 'tmdb': TMDBCatalogProvider (real Indian release catalogue)
    - 'local' (default): LocalCatalogProvider (seeded showcase catalogue)
    """
    if settings.CATALOG_SOURCE.lower() == "tmdb":
        return _tmdb_provider
    return _local_provider


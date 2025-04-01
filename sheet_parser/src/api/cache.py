"""Cache management for API responses."""
import os
import json
import time
import logging
from pathlib import Path

logger = logging.getLogger(__name__)

class ResponseCache:
    """Simple file-based cache for API responses."""
    
    def __init__(self, cache_dir=None, expire_time=3600):
        """Initialize the cache with directory and expiration time.
        
        Args:
            cache_dir (str, optional): Directory to store cache files. Defaults to '.cache'.
            expire_time (int, optional): Cache expiration time in seconds. Defaults to 3600 (1 hour).
        """
        self.cache_dir = cache_dir or Path(os.path.dirname(os.path.abspath(__file__))) / '.cache'
        self.expire_time = expire_time
        
        # Ensure the cache directory exists
        os.makedirs(self.cache_dir, exist_ok=True)
        logger.debug(f"Cache initialized at {self.cache_dir}")
    
    def _get_cache_path(self, key):
        """Get the file path for a cache key."""
        # Convert key to a safe filename by replacing non-alphanumeric chars
        safe_key = ''.join(c if c.isalnum() else '_' for c in key)
        return os.path.join(self.cache_dir, f"{safe_key}.json")
    
    def get(self, key):
        """Get cached data for a key if it exists and hasn't expired.
        
        Args:
            key (str): The cache key.
            
        Returns:
            tuple: (cached_data, True) if cache hit, (None, False) if cache miss.
        """
        cache_path = self._get_cache_path(key)
        
        if os.path.exists(cache_path):
            # Check if cache has expired
            file_mtime = os.path.getmtime(cache_path)
            if time.time() - file_mtime < self.expire_time:
                try:
                    with open(cache_path, 'r') as f:
                        cached_data = json.load(f)
                    logger.debug(f"Cache hit for key: {key}")
                    return cached_data, True
                except (json.JSONDecodeError, IOError) as e:
                    logger.warning(f"Failed to read cache for key {key}: {e}")
            else:
                logger.debug(f"Cache expired for key: {key}")
        
        return None, False
    
    def set(self, key, data):
        """Store data in the cache.
        
        Args:
            key (str): The cache key.
            data: The data to cache (must be JSON serializable).
            
        Returns:
            bool: True if successful, False otherwise.
        """
        cache_path = self._get_cache_path(key)
        
        try:
            with open(cache_path, 'w') as f:
                json.dump(data, f)
            logger.debug(f"Cache set for key: {key}")
            return True
        except (TypeError, IOError) as e:
            logger.warning(f"Failed to write cache for key {key}: {e}")
            return False
    
    def invalidate(self, key):
        """Remove a specific key from the cache.
        
        Args:
            key (str): The cache key to invalidate.
            
        Returns:
            bool: True if successful, False otherwise.
        """
        cache_path = self._get_cache_path(key)
        
        if os.path.exists(cache_path):
            try:
                os.remove(cache_path)
                logger.debug(f"Cache invalidated for key: {key}")
                return True
            except IOError as e:
                logger.warning(f"Failed to invalidate cache for key {key}: {e}")
        
        return False
    
    def clear(self):
        """Clear all cache entries.
        
        Returns:
            int: Number of cache entries cleared.
        """
        count = 0
        for cache_file in os.listdir(self.cache_dir):
            if cache_file.endswith('.json'):
                try:
                    os.remove(os.path.join(self.cache_dir, cache_file))
                    count += 1
                except IOError as e:
                    logger.warning(f"Failed to delete cache file {cache_file}: {e}")
        
        logger.debug(f"Cleared {count} cache entries")
        return count
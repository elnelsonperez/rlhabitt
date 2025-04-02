"""
Centralized logging configuration for the sheet_parser module.
This module provides a consistent logging setup for the entire application.
"""
import os
import sys
import logging

# Default log format
DEFAULT_LOG_FORMAT = '%(asctime)s [%(levelname)s] %(name)s: %(message)s'
DEFAULT_DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

# Log level mapping
LOG_LEVELS = {
    'DEBUG': logging.DEBUG,
    'INFO': logging.INFO,
    'WARNING': logging.WARNING,
    'ERROR': logging.ERROR,
    'CRITICAL': logging.CRITICAL
}

# Track if the basic config has been disabled
_basic_logging_disabled = False

def disable_basic_logging():
    """Disable the basic logging configuration to prevent duplicate logs."""
    global _basic_logging_disabled
    if not _basic_logging_disabled:
        # Remove all handlers from the root logger
        root = logging.getLogger()
        for handler in root.handlers[:]:
            root.removeHandler(handler)
        _basic_logging_disabled = True

def get_log_level():
    """Get log level from environment or default to INFO."""
    log_level = os.getenv('LOG_LEVEL', 'INFO').upper()
    return LOG_LEVELS.get(log_level, logging.INFO)

def setup_logger(name, log_file=None):
    """
    Set up a logger with consistent configuration.
    
    Args:
        name: Name of the logger (typically __name__)
        log_file: Optional path to log file. If None, will use LOG_FILE_PATH from env
                  or default to stdout only.
    
    Returns:
        A configured logger instance
    """
    # First disable any basic logging config
    disable_basic_logging()
    
    logger = logging.getLogger(name)
    
    # Remove any existing handlers to avoid duplicates
    for handler in logger.handlers[:]:
        logger.removeHandler(handler)
    
    # Prevent propagation to the root logger
    logger.propagate = False
    
    # Set log level
    logger.setLevel(get_log_level())
    
    # Create formatter
    formatter = logging.Formatter(
        fmt=os.getenv('LOG_FORMAT', DEFAULT_LOG_FORMAT),
        datefmt=os.getenv('DATE_FORMAT', DEFAULT_DATE_FORMAT)
    )
    
    # Always add console handler
    console_handler = logging.StreamHandler(sys.stdout)
    console_handler.setFormatter(formatter)
    logger.addHandler(console_handler)
    
    # Add file handler if log file is specified or available in env
    if log_file is None:
        log_file = os.getenv('LOG_FILE_PATH')
    
    if log_file and log_file != '/proc/1/fd/1':  # Skip file handler if logging to Docker stdout
        # Ensure log directory exists
        log_dir = os.path.dirname(log_file)
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)
            
        file_handler = logging.FileHandler(log_file)
        file_handler.setFormatter(formatter)
        logger.addHandler(file_handler)
    
    return logger

def get_logger(name=None):
    """
    Get a configured logger instance.
    
    Args:
        name: Optional name for the logger. If None, uses the caller's module name.
    
    Returns:
        A configured logger instance
    """
    if name is None:
        # Get the caller's module name
        import inspect
        frame = inspect.stack()[1]
        name = inspect.getmodule(frame[0]).__name__
    
    return setup_logger(name)
"""
Centralized logging configuration for the Trade Republic microservice.

Usage:
    from logging_config import setup_logging
    logger = setup_logging()
    logger.info("message")
"""

import logging
import sys
import os


def setup_logging(level: int | None = None) -> logging.Logger:
    """Configure structured logging with ISO 8601 timestamps.

    Idempotent — subsequent calls return the existing logger without
    adding duplicate handlers.

    Args:
        level: Optional log level override. Defaults to INFO, or DEBUG
               if the TR_DEBUG env var is set.

    Returns:
        The configured logger instance (namespace: "tr_service").
    """
    if level is None:
        level = logging.DEBUG if os.environ.get("TR_DEBUG") else logging.INFO

    logger = logging.getLogger("tr_service")

    # Avoid duplicate handlers on hot-reload or re-import.
    if logger.handlers:
        return logger

    handler = logging.StreamHandler(sys.stdout)
    handler.setLevel(level)
    formatter = logging.Formatter(
        "%(asctime)s [%(levelname)-5s] %(name)s: %(message)s",
        datefmt="%Y-%m-%dT%H:%M:%S",
    )
    handler.setFormatter(formatter)

    logger.setLevel(level)
    logger.addHandler(handler)
    logger.propagate = False

    return logger

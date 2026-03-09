"""Loguru dual-logger: pipeline.log (DEBUG) + stderr (INFO)."""
import sys
from pathlib import Path

from loguru import logger


def setup_logging(run_id: str) -> tuple[str, Path]:
    """
    Configure loguru sinks and return (run_id, run_dir).

    run_dir = eval/logs/runs/{run_id}
    Sinks:
      - run_dir/pipeline.log  (DEBUG, all structured events)
      - stderr                (INFO, human-readable progress)
    """
    run_dir = Path("eval/logs/runs") / run_id
    run_dir.mkdir(parents=True, exist_ok=True)

    # Remove default sink first
    logger.remove()
    logger.add(
        run_dir / "pipeline.log",
        format="{time:YYYY-MM-DD HH:mm:ss} | {level:<8} | {message}",
        level="DEBUG",
    )
    logger.add(sys.stderr, format="{time:HH:mm:ss} | {level:<8} | {message}", level="INFO")

    return run_id, run_dir

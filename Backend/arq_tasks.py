import os
import logging
from arq.connections import RedisSettings
from dotenv import load_dotenv

# Initialize settings and environment
load_dotenv()
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("arq_worker")

# Define Redis connection details
REDIS_HOST = os.getenv("REDIS_HOST", "localhost")
REDIS_PORT = int(os.getenv("REDIS_PORT", 6379))
REDIS_PASSWORD = os.getenv("REDIS_PASSWORD", None)

redis_settings = RedisSettings(
    host=REDIS_HOST,
    port=REDIS_PORT,
    password=REDIS_PASSWORD
)

# Async task wrapper for ARQ worker
async def run_background_pipeline_task(ctx, session_id: int, user_uid: str, user_msg_id: int, parsed_data: dict):
    """ARQ Worker task wrapping the main backend pipeline.
    
    This function runs asynchronously in the ARQ worker process,
    effectively offloading heavy CPU/DB operations from the main FastAPI server.
    """
    logger.info(f"ARQ Task: Starting background pipeline for session {session_id}")
    
    # We dynamically import database/pipeline operations inside the worker context
    from database import SessionLocal
    from main import save_message_analysis, process_therapeutic_pipeline, update_session_summary_task
    
    db = SessionLocal()
    try:
        # 1. Execute message analysis and clinical pipeline updates
        save_message_analysis(db, user_msg_id, parsed_data)
        process_therapeutic_pipeline(db, session_id, user_uid, user_msg_id, parsed_data)
        
        # 2. Trigger session summary update
        update_session_summary_task(session_id, user_uid)
        logger.info(f"ARQ Task: Successfully completed background pipeline for session {session_id}")
    except Exception as e:
        logger.error(f"ARQ Task Error in session {session_id}: {e}")
        db.rollback()
    finally:
        db.close()

# Startup and shutdown worker hook examples
async def startup(ctx):
    logger.info("ARQ Worker: Starting up connection pool...")

async def shutdown(ctx):
    logger.info("ARQ Worker: Shutting down connection pool gracefully...")

# ARQ Worker Configuration settings
class WorkerSettings:
    """Worker settings loaded by the arq command line tool.
    
    To run this worker:
        arq arq_tasks.WorkerSettings
    """
    functions = [run_background_pipeline_task]
    redis_settings = redis_settings
    on_startup = startup
    on_shutdown = shutdown
    max_jobs = 10
    timeout_seconds = 60

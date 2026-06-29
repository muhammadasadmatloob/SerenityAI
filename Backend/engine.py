import os
import json
import logging
import traceback
from typing import Tuple, Any

logger = logging.getLogger("runpod_engine")
logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(name)s: %(message)s")

def preflight_check_model_files(model_dir: str) -> Tuple[bool, str]:
    """Pre-flight check to verify config.json and tokenizer_config.json exist and match Llama-3 specifications."""
    logger.info(f"Running pre-flight checks on model path: {model_dir}")
    
    config_path = os.path.join(model_dir, "config.json")
    tokenizer_config_path = os.path.join(model_dir, "tokenizer_config.json")
    tokenizer_path = os.path.join(model_dir, "tokenizer.json")
    
    # 1. Verify existence of config.json
    if not os.path.exists(config_path):
        return False, f"Missing config.json at: {config_path}"
        
    # 2. Verify existence of tokenizer files
    if not os.path.exists(tokenizer_config_path) and not os.path.exists(tokenizer_path):
        return False, f"Missing tokenizer_config.json or tokenizer.json in: {model_dir}"
        
    # 3. Parse and validate config.json
    try:
        with open(config_path, "r", encoding="utf-8") as f:
            config_data = json.load(f)
    except json.JSONDecodeError as jde:
        return False, f"JSON Decode Error in config.json: {jde}"
    except Exception as e:
        return False, f"Failed to read config.json: {e}"
        
    # Check Llama architecture
    architectures = config_data.get("architectures", [])
    model_type = config_data.get("model_type", "")
    
    is_llama = any("Llama" in arch for arch in architectures) or "llama" in model_type.lower()
    if not is_llama:
        logger.warning(f"Model type '{model_type}' or architectures {architectures} do not explicitly match standard Llama format.")
        
    # 4. Parse and validate tokenizer_config.json if it exists
    if os.getenv("THERAPY_ENGINE_URL"):
        # Extra validation checks can go here
        pass
    if os.path.exists(tokenizer_config_path):
        try:
            with open(tokenizer_config_path, "r", encoding="utf-8") as f:
                tokenizer_data = json.load(f)
        except json.JSONDecodeError as jde:
            return False, f"JSON Decode Error in tokenizer_config.json: {jde}"
        except Exception as e:
            return False, f"Failed to read tokenizer_config.json: {e}"
            
        tokenizer_class = tokenizer_data.get("tokenizer_class", "")
        if tokenizer_class and "Llama" not in tokenizer_class and "PreTrainedTokenizer" not in tokenizer_class:
            logger.warning(f"Tokenizer class '{tokenizer_class}' might not match standard Llama-3 specifications.")

    return True, "Pre-flight checks passed."

def load_vllm_engine_and_tokenizer(model_dir: str, engine_args: Any = None) -> Tuple[Any, Any]:
    """Robust loader that performs pre-flight verification, catches ModelWrapper issues, and prints deep diagnostics."""
    # Run pre-flight check
    success, message = preflight_check_model_files(model_dir)
    if not success:
        logger.error(f"❌ Pre-flight Check Failed: {message}")
        raise ValueError(f"Pre-flight model file verification failed: {message}")
        
    logger.info("Pre-flight validation succeeded. Proceeding to load tokenizer and model engine...")
    
    # Try loading tokenizer
    try:
        from transformers import AutoTokenizer
        logger.info("Loading Tokenizer via AutoTokenizer...")
        tokenizer = AutoTokenizer.from_pretrained(model_dir)
        logger.info("Tokenizer loaded successfully.")
    except Exception as e:
        logger.error(f"❌ Failed to load Tokenizer from pretrained directory '{model_dir}': {e}")
        logger.error(traceback.format_exc())
        raise e
        
    # Try loading vLLM engine
    try:
        from vllm.engine.llm_engine import LLMEngine
        logger.info("Initializing LLMEngine...")
        if engine_args is None:
            from vllm.engine.arg_utils import EngineArgs
            engine_args = EngineArgs(model=model_dir)
            
        engine = LLMEngine.from_engine_args(engine_args)
        logger.info("LLMEngine initialized successfully.")
        return engine, tokenizer
    except Exception as e:
        err_msg = str(e)
        logger.error("\n" + "="*80)
        logger.error("❌ CRITICAL: ENGINE INITIALIZATION ERROR")
        logger.error(f"Exception Type: {type(e).__name__}")
        logger.error(f"Exception Message: {err_msg}")
        logger.error("="*80)
        logger.error("Full Traceback:")
        logger.error(traceback.format_exc())
        logger.error("="*80)
        
        if "ModelWrapper" in err_msg or "untagged enum" in err_msg:
            config_path = os.path.join(model_dir, "config.json")
            logger.error(f"💡 DIAGNOSTIC INFO: The untagged enum ModelWrapper error indicates vLLM failed to map {config_path}")
            logger.error("   to its registered internal model definitions.")
            logger.error("   This usually means either:")
            logger.error("   a) The 'architectures' array in config.json is not supported by this vLLM release.")
            logger.error("   b) The model type is incompatible with your current vLLM, torch, or transformers library versions.")
            logger.error("   c) You have mismatching packages. Verify vLLM vs Transformers versions.")
            logger.error("="*80 + "\n")
            
        raise e

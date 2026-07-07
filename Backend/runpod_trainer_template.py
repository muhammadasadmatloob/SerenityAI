import os
import runpod
from unsloth import FastLanguageModel
from trl import SFTTrainer
from transformers import TrainingArguments
from datasets import Dataset
import torch

# Configuration for Phi-3
MODEL_NAME = "unsloth/Phi-3-mini-4k-instruct"
MAX_SEQ_LENGTH = 2048
DTYPE = None # Auto-detects float16/bfloat16
LOAD_IN_4BIT = True

print("Loading Phi-3 base model...")
model, tokenizer = FastLanguageModel.from_pretrained(
    model_name = MODEL_NAME,
    max_seq_length = MAX_SEQ_LENGTH,
    dtype = DTYPE,
    load_in_4bit = LOAD_IN_4BIT,
)

# Apply LoRA specifically tuned for continuous learning (preventing catastrophic forgetting)
model = FastLanguageModel.get_peft_model(
    model,
    r = 16,
    target_modules = ["q_proj", "k_proj", "v_proj", "o_proj", "gate_proj", "up_proj", "down_proj"],
    lora_alpha = 16,
    lora_dropout = 0,
    bias = "none",
    use_gradient_checkpointing = "unsloth",
    random_state = 3407,
    use_rslora = False,
    loftq_config = None,
)

def format_prompts(examples):
    instructions = examples["instruction"]
    outputs      = examples["output"]
    texts = []
    for instruction, output in zip(instructions, outputs):
        text = f"<|user|>\n{instruction}<|end|>\n<|assistant|>\n{output}<|end|>"
        texts.append(text)
    return { "text" : texts }

def train_handler(job):
    """
    RunPod Serverless Handler for Continuous Learning
    Accepts: {"input": {"dataset": [{"instruction": "...", "output": "..."}]}}
    """
    job_input = job.get("input", {})
    raw_dataset = job_input.get("dataset", [])
    
    if not raw_dataset:
        return {"status": "error", "message": "No dataset provided"}
        
    print(f"Received {len(raw_dataset)} interaction(s) for learning.")
    
    dataset = Dataset.from_list(raw_dataset)
    dataset = dataset.map(format_prompts, batched=True)
    
    # Configure SFTTrainer for incremental learning
    trainer = SFTTrainer(
        model = model,
        tokenizer = tokenizer,
        train_dataset = dataset,
        dataset_text_field = "text",
        max_seq_length = MAX_SEQ_LENGTH,
        dataset_num_proc = 2,
        packing = False, # Can make training 5x faster for short sequences
        args = TrainingArguments(
            per_device_train_batch_size = 2,
            gradient_accumulation_steps = 4,
            warmup_steps = 5,
            num_train_epochs = 1, # Learn, don't memorize
            learning_rate = 1e-5, # Small learning rate to prevent forgetting old knowledge
            fp16 = not torch.cuda.is_bf16_supported(),
            bf16 = torch.cuda.is_bf16_supported(),
            logging_steps = 1,
            optim = "adamw_8bit",
            weight_decay = 0.01,
            lr_scheduler_type = "linear",
            seed = 3407,
            output_dir = "outputs",
        ),
    )
    
    # Execute fine-tuning
    trainer_stats = trainer.train()
    
    # Save the updated adapter
    model.save_pretrained("lora_model") # Local saving
    tokenizer.save_pretrained("lora_model")
    
    return {
        "status": "success", 
        "message": "Phi-3 successfully learned from new interactions.",
        "stats": {
            "global_step": trainer_stats.global_step,
            "training_loss": trainer_stats.training_loss
        }
    }

if __name__ == "__main__":
    # Start RunPod Serverless Listener
    runpod.serverless.start({"handler": train_handler})

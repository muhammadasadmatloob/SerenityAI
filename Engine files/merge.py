from peft import PeftModel
from transformers import AutoModelForCausalLM, AutoTokenizer

print("Loading base model...")
base_model = AutoModelForCausalLM.from_pretrained("microsoft/Phi-3-mini-4k-instruct")
tokenizer = AutoTokenizer.from_pretrained("microsoft/Phi-3-mini-4k-instruct")

print("Loading adapter...")
model = PeftModel.from_pretrained(base_model, "./donna-finetuned")

print("Merging...")
merged_model = model.merge_and_unload()

print("Saving merged model...")
merged_model.save_pretrained("./donna-merged")
tokenizer.save_pretrained("./donna-merged")

print("Done! Merged model saved to ./donna-merged")
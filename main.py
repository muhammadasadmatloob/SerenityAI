import os
import sys
import importlib.util

# Get absolute path of Backend directory relative to this script
backend_path = os.path.abspath(os.path.join(os.path.dirname(__file__), "Backend"))

# Change current working directory to Backend so relative file paths (.env, database, serviceAccountKey.json) resolve correctly
os.chdir(backend_path)

# Insert Backend into sys.path so modules can import database, voice_analyzer, etc. directly
sys.path.insert(0, backend_path)

# Import the FastAPI application instance dynamically from Backend/main.py
spec = importlib.util.spec_from_file_location("backend_main", os.path.join(backend_path, "main.py"))
backend_main = importlib.util.module_from_spec(spec)
sys.modules["backend_main"] = backend_main
spec.loader.exec_module(backend_main)

app = backend_main.app

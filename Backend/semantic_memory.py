import os
import uuid
import json
import math
from typing import List, Dict, Any, Optional
from fastembed import TextEmbedding
from database import SessionLocal, SemanticMemory

# Initialize fastembed Model (runs locally on CPU, module level is fine)
embedding_model = TextEmbedding(model_name="BAAI/bge-small-en-v1.5")

def cosine_similarity(v1: List[float], v2: List[float]) -> float:
    dot_product = sum(x * y for x, y in zip(v1, v2))
    norm_v1 = math.sqrt(sum(x * x for x in v1))
    norm_v2 = math.sqrt(sum(x * x for x in v2))
    if norm_v1 == 0 or norm_v2 == 0:
        return 0.0
    return dot_product / (norm_v1 * norm_v2)

def add_semantic_memory(
    user_uid: str,
    content: str,
    memory_type: str,
    session_id: int,
    importance: int = 5
) -> bool:
    """
    Saves a semantic memory in the database.
    Deduplicates: If a highly similar memory (cosine similarity > 0.85) exists for this user,
    it updates the existing memory rather than creating a duplicate.
    """
    if not content or not content.strip():
        return False
    
    content = content.strip()
    
    # 1. Generate text embedding
    try:
        embeddings = list(embedding_model.embed([content]))
        vector = [float(x) for x in embeddings[0]]
    except Exception as e:
        print(f"Failed to generate embedding for memory: {e}")
        return False

    db = SessionLocal()
    try:
        # 2. Check for duplicates (Deduplication)
        # Fetch all existing memories for this user
        existing_memories = db.query(SemanticMemory).filter_by(user_uid=user_uid).all()
        
        best_match = None
        best_score = -1.0
        
        for mem in existing_memories:
            try:
                mem_vector = json.loads(mem.vector_data)
                score = cosine_similarity(vector, mem_vector)
                if score > best_score:
                    best_score = score
                    best_match = mem
            except Exception as e_parse:
                print(f"Failed to parse vector data for memory {mem.id}: {e_parse}")
                continue
        
        # If highly similar memory exists (similarity > 0.85), merge/update it
        if best_match and best_score > 0.85:
            print(f"Deduplicated memory. Updating existing DB point {best_match.id} (Score: {best_score:.3f})")
            best_match.content = content  # Update with latest phrasing
            best_match.memory_type = memory_type
            best_match.session_id = session_id
            best_match.importance = max(importance, best_match.importance or 5)
            best_match.vector_data = json.dumps(vector) # update vector
            db.commit()
            return True
            
        # 3. Create a new memory point in the database
        point_id = str(uuid.uuid4())
        new_mem = SemanticMemory(
            id=point_id,
            user_uid=user_uid,
            content=content,
            memory_type=memory_type,
            session_id=session_id,
            importance=importance,
            vector_data=json.dumps(vector)
        )
        db.add(new_mem)
        db.commit()
        print(f"Saved new semantic memory point: {point_id}")
        return True
    except Exception as e:
        print(f"Failed to save memory point in DB: {e}")
        db.rollback()
        return False
    finally:
        db.close()

def retrieve_semantic_memories(user_uid: str, query: str, limit: int = 5) -> List[Dict[str, Any]]:
    """
    Performs semantic search against relational DB to retrieve relevant memories for a user.
    """
    if not query or not query.strip():
        return []

    try:
        embeddings = list(embedding_model.embed([query.strip()]))
        vector = [float(x) for x in embeddings[0]]
    except Exception as e:
        print(f"Failed to generate embedding for retrieval query: {e}")
        return []

    db = SessionLocal()
    try:
        existing_memories = db.query(SemanticMemory).filter_by(user_uid=user_uid).all()
        scored_memories = []
        
        for mem in existing_memories:
            try:
                mem_vector = json.loads(mem.vector_data)
                score = cosine_similarity(vector, mem_vector)
                scored_memories.append((score, mem))
            except Exception as e_parse:
                print(f"Failed to parse vector data for memory {mem.id}: {e_parse}")
                continue
                
        # Sort by similarity score in descending order
        scored_memories.sort(key=lambda x: x[0], reverse=True)
        
        # Take the top N
        top_memories = scored_memories[:limit]
        
        memories = []
        for score, mem in top_memories:
            memories.append({
                "content": mem.content,
                "memory_type": mem.memory_type,
                "session_id": mem.session_id,
                "importance": mem.importance,
                "score": score
            })
        return memories
    except Exception as e:
        print(f"DB semantic search failed: {e}")
        return []
    finally:
        db.close()

import json
import sys

def validate_n8n_json(filepath):
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        # Basic n8n structure check
        if "nodes" not in data or "connections" not in data:
            print("Error: Missing 'nodes' or 'connections' in n8n JSON.")
            sys.exit(1)
        
        # Check for unique IDs
        ids = [node.get("id") for node in data["nodes"]]
        if len(ids) != len(set(ids)):
            print("Error: Duplicate node IDs found.")
            sys.exit(1)
            
        print("JSON is valid and follows basic n8n structure.")
    except Exception as e:
        print(f"Error validating JSON: {e}")
        sys.exit(1)

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python validate_json.py <filepath>")
        sys.exit(1)
    validate_n8n_json(sys.argv[1])

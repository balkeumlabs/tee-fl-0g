import json
import hashlib
from sklearn.linear_model import LogisticRegression
import numpy as np

# Load input data
with open('data.json', 'r') as f:
    data = json.load(f)

X = np.array(data["input"])
y = np.array(data["label"])

# Train logistic regression
model = LogisticRegression()
model.fit(X, y)

# Extract and save model weights
model_dict = {
    "coef": model.coef_.tolist(),
    "intercept": model.intercept_.tolist()
}

with open('trained_model.json', 'w') as f:
    json.dump(model_dict, f, indent=2)

# Compute result hash
with open('trained_model.json', 'rb') as f:
    contents = f.read()
    result_hash = hashlib.sha256(contents).hexdigest()

print("✅ Trained model saved to trained_model.json")
print("🔐 Result Hash:", result_hash)

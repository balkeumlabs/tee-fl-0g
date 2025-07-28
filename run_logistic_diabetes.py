from sklearn.datasets import load_diabetes
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import Binarizer
from sklearn.metrics import accuracy_score
import hashlib
import numpy as np
import json

# Load diabetes dataset (regression target originally)
data = load_diabetes()
X = data.data
y_continuous = data.target

# Binarize the target: above-median = 1 (diabetic), below = 0 (non-diabetic)
threshold = np.median(y_continuous)
y = Binarizer(threshold=threshold).fit_transform(y_continuous.reshape(-1, 1)).ravel()

# Split and train logistic regression
X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.3, random_state=42)
clf = LogisticRegression(max_iter=1000)
clf.fit(X_train, y_train)
y_pred = clf.predict(X_test)

# Evaluate
acc = accuracy_score(y_test, y_pred)
print("Accuracy:", acc)

# Serialize model coefficients and accuracy to string
model_output = {
    "coefficients": clf.coef_.tolist(),
    "intercept": clf.intercept_.tolist(),
    "accuracy": acc
}

# Write model output to file
with open("model_output.json", "w") as f:
    json.dump(model_output, f, indent=2)

# Hash the output file
with open("model_output.json", "rb") as f:
    content = f.read()
    hash_value = hashlib.sha256(content).hexdigest()

print("SHA-256 Hash of model_output.json:", hash_value)

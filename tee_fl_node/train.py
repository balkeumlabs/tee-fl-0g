from sklearn.datasets import load_diabetes
from sklearn.linear_model import LogisticRegression
from sklearn.model_selection import train_test_split
from sklearn.metrics import accuracy_score
import joblib, json

# Load and prepare dataset
X, y = load_diabetes(return_X_y=True)
y = (y > y.mean()).astype(int)  # Convert to binary classification

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

# Train logistic regression model
model = LogisticRegression(max_iter=1000)
model.fit(X_train, y_train)

# Evaluate
y_pred = model.predict(X_test)
accuracy = accuracy_score(y_test, y_pred)
print(f"Accuracy: {accuracy}")

# Save model
joblib.dump(model, "model.pkl")

# Save metrics
with open("metrics.json", "w") as f:
    json.dump({"accuracy": accuracy}, f)

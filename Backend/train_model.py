import os
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestRegressor
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler
import joblib

def create_dummy_data():
    # Simulate data: topic_id, recent_score, attempts -> gap_severity (0.0 to 1.0, higher means larger gap)
    np.random.seed(42)
    data = {
        'topic_id': np.random.randint(1, 10, 500),
        'recent_score': np.random.uniform(0.1, 1.0, 500),
        'attempts': np.random.randint(1, 5, 500)
    }
    df = pd.DataFrame(data)

    # Gap severity is high if score is low and attempts are high (meaning struggling)
    # Gap severity is low if score is high
    def get_severity(row):
        score = row['recent_score']
        attempts = row['attempts']
        severity = (1.0 - score) + (attempts * 0.05)
        severity = min(max(severity, 0.0), 1.0)
        return severity

    df['gap_severity'] = df.apply(get_severity, axis=1)
    return df

def train_recommender():
    df = create_dummy_data()
    X = df[['topic_id', 'recent_score', 'attempts']]
    y = df['gap_severity']

    pipeline = Pipeline([
        ('scaler', StandardScaler()),
        ('rf', RandomForestRegressor(n_estimators=50, random_state=42))
    ])

    pipeline.fit(X, y)

    # Ensure model directory exists
    model_dir = os.path.join('app', 'ml_models')
    os.makedirs(model_dir, exist_ok=True)
    
    model_path = os.path.join(model_dir, 'gap_recommender.pkl')
    joblib.dump(pipeline, model_path)
    print(f"Model saved successfully to {model_path}")

if __name__ == "__main__":
    train_recommender()

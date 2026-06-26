import os
import sqlite3
import json
from datetime import datetime

DB_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
DB_PATH = os.path.join(DB_DIR, "credit_risk.db")

# Ensure database directory exists
os.makedirs(DB_DIR, exist_ok=True)

def get_db_connection():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # 1. Users Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK (role IN ('admin', 'user'))
    )
    """)
    
    # 2. Predictions Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS predictions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER,
        full_name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        income REAL NOT NULL,
        employment_status TEXT NOT NULL,
        loan_amount REAL NOT NULL,
        loan_term INTEGER NOT NULL,
        credit_score INTEGER NOT NULL,
        existing_debt REAL NOT NULL,
        education TEXT NOT NULL,
        marital_status TEXT NOT NULL,
        dependents INTEGER NOT NULL,
        property_area TEXT NOT NULL,
        prediction TEXT NOT NULL,
        probability REAL NOT NULL,
        risk_score REAL NOT NULL,
        risk_class TEXT NOT NULL,
        contributing_factors TEXT NOT NULL, -- JSON string
        timestamp TEXT NOT NULL,
        FOREIGN KEY (user_id) REFERENCES users (id)
    )
    """)
    
    # 3. Datasets Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS datasets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        filename TEXT NOT NULL,
        filepath TEXT NOT NULL,
        row_count INTEGER NOT NULL,
        upload_timestamp TEXT NOT NULL,
        is_active INTEGER DEFAULT 0
    )
    """)
    
    # 4. Models Table
    cursor.execute("""
    CREATE TABLE IF NOT EXISTS models (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        accuracy REAL NOT NULL,
        precision REAL NOT NULL,
        recall REAL NOT NULL,
        f1_score REAL NOT NULL,
        roc_auc REAL NOT NULL,
        selected_features TEXT NOT NULL, -- JSON string list
        filepath TEXT NOT NULL,
        is_active INTEGER DEFAULT 0,
        timestamp TEXT NOT NULL
    )
    """)
    
    conn.commit()
    conn.close()

# User Operations
def create_user(username, password_hash, role="user"):
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute(
            "INSERT INTO users (username, password_hash, role) VALUES (?, ?, ?)",
            (username, password_hash, role)
        )
        conn.commit()
        user_id = cursor.lastrowid
        return {"id": user_id, "username": username, "role": role}
    except sqlite3.IntegrityError:
        return None
    finally:
        conn.close()

def get_user_by_username(username):
    conn = get_db_connection()
    cursor = conn.cursor()
    row = cursor.execute("SELECT * FROM users WHERE username = ?", (username,)).fetchone()
    conn.close()
    return dict(row) if row else None

# Prediction Operations
def save_prediction(user_id, data, prediction, probability, risk_score, risk_class, contributing_factors):
    conn = get_db_connection()
    cursor = conn.cursor()
    timestamp = datetime.now().isoformat()
    cursor.execute("""
    INSERT INTO predictions (
        user_id, full_name, age, gender, income, employment_status, 
        loan_amount, loan_term, credit_score, existing_debt, 
        education, marital_status, dependents, property_area, 
        prediction, probability, risk_score, risk_class, 
        contributing_factors, timestamp
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    """, (
        user_id, data["full_name"], data["age"], data["gender"], data["income"], data["employment_status"],
        data["loan_amount"], data["loan_term"], data["credit_score"], data["existing_debt"],
        data["education"], data["marital_status"], data["dependents"], data["property_area"],
        prediction, probability, risk_score, risk_class,
        json.dumps(contributing_factors), timestamp
    ))
    conn.commit()
    pred_id = cursor.lastrowid
    conn.close()
    return pred_id

def get_predictions_by_user(user_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    rows = cursor.execute(
        "SELECT * FROM predictions WHERE user_id = ? ORDER BY timestamp DESC", 
        (user_id,)
    ).fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_all_predictions():
    conn = get_db_connection()
    cursor = conn.cursor()
    rows = cursor.execute("SELECT * FROM predictions ORDER BY timestamp DESC").fetchall()
    conn.close()
    return [dict(row) for row in rows]

# Dataset Operations
def add_dataset(filename, filepath, row_count):
    conn = get_db_connection()
    cursor = conn.cursor()
    timestamp = datetime.now().isoformat()
    # Check if there are any other datasets, if not, set this as active
    count = cursor.execute("SELECT COUNT(*) FROM datasets").fetchone()[0]
    is_active = 1 if count == 0 else 0
    
    cursor.execute(
        "INSERT INTO datasets (filename, filepath, row_count, upload_timestamp, is_active) VALUES (?, ?, ?, ?, ?)",
        (filename, filepath, row_count, timestamp, is_active)
    )
    conn.commit()
    dataset_id = cursor.lastrowid
    conn.close()
    return dataset_id

def get_active_dataset():
    conn = get_db_connection()
    cursor = conn.cursor()
    row = cursor.execute("SELECT * FROM datasets WHERE is_active = 1").fetchone()
    conn.close()
    return dict(row) if row else None

def set_active_dataset(dataset_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("UPDATE datasets SET is_active = 0")
    cursor.execute("UPDATE datasets SET is_active = 1 WHERE id = ?", (dataset_id,))
    conn.commit()
    conn.close()

def get_datasets():
    conn = get_db_connection()
    cursor = conn.cursor()
    rows = cursor.execute("SELECT * FROM datasets ORDER BY upload_timestamp DESC").fetchall()
    conn.close()
    return [dict(row) for row in rows]

# Model Operations
def save_model(name, accuracy, precision, recall, f1_score, roc_auc, selected_features, filepath):
    conn = get_db_connection()
    cursor = conn.cursor()
    timestamp = datetime.now().isoformat()
    
    # Deactivate other models
    cursor.execute("UPDATE models SET is_active = 0")
    
    cursor.execute("""
    INSERT INTO models (name, accuracy, precision, recall, f1_score, roc_auc, selected_features, filepath, is_active, timestamp)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, 1, ?)
    """, (name, accuracy, precision, recall, f1_score, roc_auc, json.dumps(selected_features), filepath, timestamp))
    conn.commit()
    model_id = cursor.lastrowid
    conn.close()
    return model_id

def get_active_model():
    conn = get_db_connection()
    cursor = conn.cursor()
    row = cursor.execute("SELECT * FROM models WHERE is_active = 1").fetchone()
    conn.close()
    return dict(row) if row else None

def get_models():
    conn = get_db_connection()
    cursor = conn.cursor()
    rows = cursor.execute("SELECT * FROM models ORDER BY timestamp DESC").fetchall()
    conn.close()
    return [dict(row) for row in rows]

def get_system_stats():
    conn = get_db_connection()
    cursor = conn.cursor()
    
    total_apps = cursor.execute("SELECT COUNT(*) FROM predictions").fetchone()[0]
    approved_apps = cursor.execute("SELECT COUNT(*) FROM predictions WHERE prediction = 'Approved'").fetchone()[0]
    rejected_apps = cursor.execute("SELECT COUNT(*) FROM predictions WHERE prediction = 'Rejected'").fetchone()[0]
    active_users = cursor.execute("SELECT COUNT(*) FROM users").fetchone()[0]
    
    conn.close()
    
    approval_rate = (approved_apps / total_apps * 100) if total_apps > 0 else 0
    rejection_rate = (rejected_apps / total_apps * 100) if total_apps > 0 else 0
    
    return {
        "total_applications": total_apps,
        "approved_applications": approved_apps,
        "rejected_applications": rejected_apps,
        "approval_rate": round(approval_rate, 2),
        "rejection_rate": round(rejection_rate, 2),
        "active_users": active_users
    }

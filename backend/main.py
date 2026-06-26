import os
import shutil
import json
import csv
from typing import List, Optional
from fastapi import FastAPI, Depends, HTTPException, status, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from backend import database, auth, ml_pipeline

app = FastAPI(title="Credit Risk Analysis API", version="1.0.0")

# Enable CORS for React frontend integration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For local development; narrow this down in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Startup Seeding and Database Initialization
@app.on_event("startup")
def startup_db_and_seed():
    # 1. Initialize SQLite Database
    database.init_db()
    
    # 2. Seed Default Admin Account
    if not database.get_user_by_username("admin"):
        admin_hash = auth.get_password_hash("admin123")
        database.create_user("admin", admin_hash, role="admin")
        print("Admin user seeded: admin / admin123")
        
    # 3. Seed Default Normal User Account
    if not database.get_user_by_username("user"):
        user_hash = auth.get_password_hash("user123")
        database.create_user("user", user_hash, role="user")
        print("Normal user seeded: user / user123")
        
    # 4. Check for existing datasets, if empty auto-generate the synthetic dataset
    datasets = database.get_datasets()
    if len(datasets) == 0:
        ml_pipeline.generate_sample_dataset()
        
    # 5. Check for active model, if none pre-train using default features
    active_model = database.get_active_model()
    if not active_model or not os.path.exists(ml_pipeline.MODEL_PATH):
        print("No active model found. Training default models...")
        try:
            ml_pipeline.train_all_models()
            print("Default models trained and active model selected.")
        except Exception as e:
            print(f"Error training initial model: {e}")

# Pydantic Schemas
class SignupRequest(BaseModel):
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6)
    role: Optional[str] = Field("user", pattern="^(admin|user)$")

class LoginRequest(BaseModel):
    username: str
    password: str

class LoanApplicationRequest(BaseModel):
    full_name: str
    age: int = Field(..., ge=18, le=100)
    gender: str = Field(..., pattern="^(Male|Female)$")
    income: float = Field(..., gt=0)
    employment_status: str = Field(..., pattern="^(Employed|Self-Employed|Unemployed|Student)$")
    loan_amount: float = Field(..., gt=0)
    loan_term: int = Field(..., gt=0)  # in months
    credit_score: int = Field(..., ge=300, le=850)
    existing_debt: float = Field(..., ge=0)
    education: str = Field(..., pattern="^(High School|Associate|Bachelor|Master|PhD)$")
    marital_status: str = Field(..., pattern="^(Single|Married|Divorced)$")
    dependents: int = Field(..., ge=0, le=20)
    property_area: str = Field(..., pattern="^(Urban|Semi-Urban|Rural)$")

class TrainRequest(BaseModel):
    selected_features: Optional[List[str]] = None

# AUTH ENDPOINTS
@app.post("/api/auth/signup")
def signup(payload: SignupRequest):
    user_exists = database.get_user_by_username(payload.username)
    if user_exists:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Username already registered"
        )
    password_hash = auth.get_password_hash(payload.password)
    user = database.create_user(payload.username, password_hash, payload.role)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Error creating user"
        )
    
    # Auto-generate token on signup
    token = auth.create_access_token({"sub": user["username"], "role": user["role"], "id": user["id"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user["username"],
        "role": user["role"],
        "id": user["id"]
    }

@app.post("/api/auth/login")
def login(payload: LoginRequest):
    user = database.get_user_by_username(payload.username)
    if not user or not auth.verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password"
        )
    
    token = auth.create_access_token({"sub": user["username"], "role": user["role"], "id": user["id"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "username": user["username"],
        "role": user["role"],
        "id": user["id"]
    }

@app.get("/api/auth/me")
def get_me(current_user: dict = Depends(auth.get_current_user)):
    return current_user

# DASHBOARD STATISTICS
@app.get("/api/dashboard/stats")
def get_dashboard_stats(current_user: dict = Depends(auth.get_current_user)):
    # General stats
    stats = database.get_system_stats()
    
    # If the caller is a normal user, customize stats to their history
    if current_user["role"] == "user":
        user_preds = database.get_predictions_by_user(current_user["id"])
        total_user_apps = len(user_preds)
        approved_user = sum(1 for p in user_preds if p["prediction"] == "Approved")
        rejected_user = sum(1 for p in user_preds if p["prediction"] == "Rejected")
        
        user_approval_rate = (approved_user / total_user_apps * 100) if total_user_apps > 0 else 0
        user_rejection_rate = (rejected_user / total_user_apps * 100) if total_user_apps > 0 else 0
        
        stats["user_stats"] = {
            "total_applications": total_user_apps,
            "approved_applications": approved_user,
            "rejected_applications": rejected_user,
            "approval_rate": round(user_approval_rate, 2),
            "rejection_rate": round(user_rejection_rate, 2)
        }
        
    # Append active model metrics
    active_model = database.get_active_model()
    if active_model:
        stats["active_model"] = {
            "name": active_model["name"],
            "accuracy": active_model["accuracy"],
            "f1_score": active_model["f1_score"],
            "timestamp": active_model["timestamp"]
        }
    else:
        stats["active_model"] = None
        
    return stats

# PREDICTION ENDPOINTS
@app.post("/api/predictions/predict")
def predict_loan_approval(payload: LoanApplicationRequest, current_user: dict = Depends(auth.get_current_user)):
    data_dict = payload.dict()
    # Map pydantic field names to dictionary keys corresponding to ML inputs
    ml_input = {
        "Age": data_dict["age"],
        "Gender": data_dict["gender"],
        "Income": data_dict["income"],
        "Employment Status": data_dict["employment_status"],
        "Loan Amount": data_dict["loan_amount"],
        "Loan Term": data_dict["loan_term"],
        "Credit Score": data_dict["credit_score"],
        "Existing Debt": data_dict["existing_debt"],
        "Education": data_dict["education"],
        "Marital Status": data_dict["marital_status"],
        "Number of Dependents": data_dict["dependents"],
        "Property Area": data_dict["property_area"]
    }
    
    try:
        results = ml_pipeline.run_predictions(ml_input)
        
        # Save prediction under current user's history
        database.save_prediction(
            user_id=current_user["id"],
            data=data_dict,
            prediction=results["prediction"],
            probability=results["probability"],
            risk_score=results["risk_score"],
            risk_class=results["risk_class"],
            contributing_factors=results["contributing_factors"]
        )
        
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Inference pipeline execution failed: {e}"
        )

@app.get("/api/predictions/history")
def get_prediction_history(current_user: dict = Depends(auth.get_current_user)):
    if current_user["role"] == "admin":
        # Admin gets everything
        preds = database.get_all_predictions()
    else:
        # User gets their own
        preds = database.get_predictions_by_user(current_user["id"])
        
    # Unpack JSON contributing factors
    for pred in preds:
        try:
            pred["contributing_factors"] = json.loads(pred["contributing_factors"])
        except Exception:
            pred["contributing_factors"] = {}
            
    return preds

# ADMIN DATASET MANAGEMENT ENDPOINTS
@app.post("/api/dataset/upload")
def upload_dataset(file: UploadFile = File(...), current_user: dict = Depends(auth.require_admin)):
    if not file.filename.endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="File must be a CSV dataset"
        )
        
    uploads_dir = os.path.join(ml_pipeline.DATA_DIR, "uploads")
    os.makedirs(uploads_dir, exist_ok=True)
    
    # Save CSV locally
    filepath = os.path.join(uploads_dir, f"{int(datetime.utcnow().timestamp())}_{file.filename}")
    with open(filepath, "wb") as buffer:
        shutil.copyfileobj(file.file, buffer)
        
    # Validate and map columns
    try:
        mapped_path = ml_pipeline.map_kaggle_columns(filepath)
        with open(mapped_path, newline="", encoding="utf-8") as f:
            row_count = sum(1 for _ in csv.reader(f)) - 1
        dataset_id = database.add_dataset(file.filename, mapped_path, row_count)
        
        # Set uploaded dataset as active
        database.set_active_dataset(dataset_id)
        
        return {
            "message": "Dataset uploaded, auto-mapped to standard schema, and set as active successfully",
            "dataset_id": dataset_id,
            "row_count": row_count
        }
    except Exception as e:
        if os.path.exists(filepath):
            os.remove(filepath)
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to parse CSV dataset: {e}"
        )

@app.get("/api/dataset/status")
def get_dataset_status(current_user: dict = Depends(auth.require_admin)):
    active = database.get_active_dataset()
    datasets = database.get_datasets()
    
    status_info = {
        "active_dataset": active,
        "all_datasets": datasets,
        "preprocessing_status": "Not Cleaned"
    }
    
    if active:
        # Check if preprocessed variables exist (i.e. model trained on this dataset)
        active_model = database.get_active_model()
        if active_model:
            status_info["preprocessing_status"] = "Completed (Cleaned, Scaled & Encoders Fitted)"
            
    return status_info

@app.post("/api/dataset/preprocess")
def run_dataset_preprocessing(current_user: dict = Depends(auth.require_admin)):
    active = database.get_active_dataset()
    if not active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No active dataset to preprocess. Generate or upload one first."
        )
    try:
        with open(active["filepath"], newline="", encoding="utf-8") as f:
            reader = csv.DictReader(f)
            rows = list(reader)
        row_count = len(rows)
        if row_count == 0:
            raise ValueError("Active dataset is empty")

        numeric_cols = set()
        cat_cols = set()
        for key in rows[0].keys():
            values = [row.get(key, "") for row in rows[:10]]
            numeric_values = 0
            for value in values:
                try:
                    float(value)
                    numeric_values += 1
                except Exception:
                    pass
            if numeric_values >= 7:
                numeric_cols.add(key)
            else:
                cat_cols.add(key)

        return {
            "status": "Preprocessing successful",
            "active_dataset": active["filename"],
            "total_rows": row_count,
            "numerical_features": len(numeric_cols),
            "categorical_features": len(cat_cols),
            "imputation": "Numerical: Median, Categorical: Mode",
            "normalization": "Standard Scaler Fitted",
            "encoding": "One-Hot Encoding Applied"
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Preprocessing failed: {e}"
        )

@app.get("/api/dataset/eda")
def get_eda_visuals(current_user: dict = Depends(auth.require_admin)):
    try:
        return ml_pipeline.get_eda_data()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"EDA metrics generation failed: {e}"
        )

@app.get("/api/dataset/features")
def get_features_for_selection(current_user: dict = Depends(auth.require_admin)):
    try:
        return ml_pipeline.get_feature_info()
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Feature discovery failed: {e}"
        )

# ADMIN MODEL ENDPOINTS
@app.post("/api/model/train")
def train_and_select_model(payload: TrainRequest, current_user: dict = Depends(auth.require_admin)):
    try:
        results = ml_pipeline.train_all_models(selected_features=payload.selected_features)
        return results
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Model training and selection failed: {e}"
        )

@app.get("/api/model/comparison")
def get_model_comparisons(current_user: dict = Depends(auth.require_admin)):
    models = database.get_models()
    return models

# KAGGLE SAMPLE INPUT ENDPOINTS (available to all authenticated users)
@app.get("/api/dataset/column-map")
def get_kaggle_column_map(current_user: dict = Depends(auth.get_current_user)):
    """
    Returns the mapping table that shows how common Kaggle CSV column names
    are automatically normalized to our standard schema on upload.
    """
    column_map = [
        {"kaggle": "ApplicantIncome",            "ours": "Income",                  "dataset": "Loan Prediction"},
        {"kaggle": "CoapplicantIncome",           "ours": "Income (added)",           "dataset": "Loan Prediction"},
        {"kaggle": "LoanAmount (×1000)",          "ours": "Loan Amount",              "dataset": "Loan Prediction"},
        {"kaggle": "Loan_Amount_Term",            "ours": "Loan Term",                "dataset": "Loan Prediction"},
        {"kaggle": "Credit_History (0/1)",        "ours": "Credit Score (450/750)",   "dataset": "Loan Prediction"},
        {"kaggle": "Education",                   "ours": "Education",                "dataset": "Loan Prediction"},
        {"kaggle": "Married (Y/N)",               "ours": "Marital Status",           "dataset": "Loan Prediction"},
        {"kaggle": "Dependents",                  "ours": "Number of Dependents",     "dataset": "Loan Prediction"},
        {"kaggle": "Property_Area",               "ours": "Property Area",            "dataset": "Loan Prediction"},
        {"kaggle": "person_age",                  "ours": "Age",                      "dataset": "Credit Risk"},
        {"kaggle": "person_income (/12)",         "ours": "Income",                   "dataset": "Credit Risk"},
        {"kaggle": "person_emp_length",           "ours": "Employment Status",        "dataset": "Credit Risk"},
        {"kaggle": "person_education",            "ours": "Education",                "dataset": "Credit Risk"},
        {"kaggle": "loan_amnt",                   "ours": "Loan Amount",              "dataset": "Credit Risk"},
        {"kaggle": "loan_term (months)",          "ours": "Loan Term",                "dataset": "Credit Risk"},
        {"kaggle": "cb_person_cred_hist_length",  "ours": "Credit Score (derived)",   "dataset": "Credit Risk"},
        {"kaggle": "loan_status (0/1)",           "ours": "Loan Status",              "dataset": "Credit Risk"},
        {"kaggle": "credit_amount",               "ours": "Loan Amount",              "dataset": "German Credit"},
        {"kaggle": "duration (months)",           "ours": "Loan Term",                "dataset": "German Credit"},
        {"kaggle": "savings_account",             "ours": "Existing Debt (inferred)", "dataset": "German Credit"},
        {"kaggle": "job",                         "ours": "Employment Status",        "dataset": "German Credit"},
        {"kaggle": "sex",                         "ours": "Gender",                   "dataset": "German Credit"},
        {"kaggle": "age",                         "ours": "Age",                      "dataset": "German Credit"},
    ]
    return column_map

@app.get("/api/dataset/kaggle-samples")
def get_kaggle_sample_profiles(current_user: dict = Depends(auth.get_current_user)):
    """
    Returns six pre-built sample applicant profiles derived from well-known
    Kaggle datasets: Loan Prediction, Credit Risk, and German Credit.
    Used by the frontend Sample Input Loader to pre-fill the prediction form.
    """
    samples = [
        {
            "label": "✅ Strong Applicant (Loan Prediction DS)",
            "kaggle_source": "Loan Prediction Dataset",
            "description": "Married Graduate, Urban, Credit_History=1 → ApplicantIncome=6000, LoanAmount=150k",
            "data": {
                "full_name": "Priya Sharma", "age": 34, "gender": "Female",
                "income": 6000, "employment_status": "Employed",
                "loan_amount": 150000, "loan_term": 360, "credit_score": 750,
                "existing_debt": 1800, "education": "Bachelor",
                "marital_status": "Married", "dependents": 1, "property_area": "Urban"
            }
        },
        {
            "label": "⚠️ Risky Applicant (Loan Prediction DS)",
            "kaggle_source": "Loan Prediction Dataset",
            "description": "Self-Employed, Rural, Credit_History=0 → low income, high loan request",
            "data": {
                "full_name": "Rajesh Kumar", "age": 42, "gender": "Male",
                "income": 2500, "employment_status": "Self-Employed",
                "loan_amount": 200000, "loan_term": 360, "credit_score": 450,
                "existing_debt": 18000, "education": "High School",
                "marital_status": "Married", "dependents": 3, "property_area": "Rural"
            }
        },
        {
            "label": "✅ Low-Risk Professional (Credit Risk DS)",
            "kaggle_source": "Credit Risk Dataset",
            "description": "person_age=28, person_income=72000, cb_cred_hist_length=3, loan_intent=PERSONAL",
            "data": {
                "full_name": "Aisha Patel", "age": 28, "gender": "Female",
                "income": 6000, "employment_status": "Employed",
                "loan_amount": 9000, "loan_term": 36, "credit_score": 720,
                "existing_debt": 1200, "education": "Master",
                "marital_status": "Single", "dependents": 0, "property_area": "Urban"
            }
        },
        {
            "label": "🔴 High-Risk Young Borrower (Credit Risk DS)",
            "kaggle_source": "Credit Risk Dataset",
            "description": "person_age=22, person_income=30000, loan_intent=EDUCATION, high loan_percent_income",
            "data": {
                "full_name": "Arjun Mehta", "age": 22, "gender": "Male",
                "income": 2500, "employment_status": "Student",
                "loan_amount": 20000, "loan_term": 60, "credit_score": 580,
                "existing_debt": 5000, "education": "Associate",
                "marital_status": "Single", "dependents": 0, "property_area": "Semi-Urban"
            }
        },
        {
            "label": "✅ Creditworthy Senior (German Credit DS)",
            "kaggle_source": "German Credit Dataset",
            "description": "Skilled worker, owned property, 12-month duration, savings>1000DM, good credit class",
            "data": {
                "full_name": "Hans Werner", "age": 52, "gender": "Male",
                "income": 5200, "employment_status": "Employed",
                "loan_amount": 12000, "loan_term": 12, "credit_score": 780,
                "existing_debt": 800, "education": "Bachelor",
                "marital_status": "Married", "dependents": 2, "property_area": "Urban"
            }
        },
        {
            "label": "⚠️ Unemployed Risk Case (German Credit DS)",
            "kaggle_source": "German Credit Dataset",
            "description": "Unemployed/unskilled, 48-month loan, no savings, multiple existing credits at bank",
            "data": {
                "full_name": "Luisa Braun", "age": 38, "gender": "Female",
                "income": 1800, "employment_status": "Unemployed",
                "loan_amount": 50000, "loan_term": 48, "credit_score": 480,
                "existing_debt": 22000, "education": "High School",
                "marital_status": "Divorced", "dependents": 1, "property_area": "Rural"
            }
        }
    ]
    return samples

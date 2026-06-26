import os
import json
import pickle
import numpy as np
import pandas as pd
from datetime import datetime

# ML Models
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LogisticRegression
from sklearn.tree import DecisionTreeClassifier
from sklearn.ensemble import RandomForestClassifier
from xgboost import XGBClassifier
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score

import database

DATA_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "data")
MODEL_PATH = os.path.join(DATA_DIR, "active_model.pkl")

# Helper to load joblib or pickle
def save_serialized_model(obj, path):
    with open(path, "wb") as f:
        pickle.dump(obj, f)

def load_serialized_model(path):
    with open(path, "rb") as f:
        return pickle.load(f)

def generate_sample_dataset():
    """
    Generates a realistic synthetic credit risk dataset.
    """
    os.makedirs(DATA_DIR, exist_ok=True)
    csv_path = os.path.join(DATA_DIR, "sample_credit_risk.csv")
    
    # Set seed for reproducibility
    np.random.seed(42)
    n_samples = 1200
    
    # Generate columns
    age = np.random.randint(18, 70, size=n_samples)
    gender = np.random.choice(["Male", "Female"], size=n_samples, p=[0.55, 0.45])
    income = np.round(np.random.uniform(1500, 25000, size=n_samples), 2)
    employment_status = np.random.choice(
        ["Employed", "Self-Employed", "Unemployed", "Student"], 
        size=n_samples, 
        p=[0.70, 0.15, 0.08, 0.07]
    )
    loan_amount = np.round(np.random.uniform(5000, 250000, size=n_samples), 2)
    loan_term = np.random.choice([12, 24, 36, 60, 120, 180, 240, 360], size=n_samples, p=[0.05, 0.05, 0.10, 0.20, 0.20, 0.15, 0.15, 0.10])
    credit_score = np.random.randint(300, 850, size=n_samples)
    existing_debt = np.round(np.random.uniform(0, 50000, size=n_samples), 2)
    education = np.random.choice(
        ["High School", "Associate", "Bachelor", "Master", "PhD"],
        size=n_samples,
        p=[0.30, 0.15, 0.40, 0.12, 0.03]
    )
    marital_status = np.random.choice(["Single", "Married", "Divorced"], size=n_samples, p=[0.40, 0.45, 0.15])
    dependents = np.random.choice([0, 1, 2, 3, 4], size=n_samples, p=[0.50, 0.20, 0.15, 0.10, 0.05])
    property_area = np.random.choice(["Urban", "Semi-Urban", "Rural"], size=n_samples, p=[0.35, 0.40, 0.25])
    
    # Create DataFrame
    df = pd.DataFrame({
        "Age": age,
        "Gender": gender,
        "Income": income,
        "Employment Status": employment_status,
        "Loan Amount": loan_amount,
        "Loan Term": loan_term,
        "Credit Score": credit_score,
        "Existing Debt": existing_debt,
        "Education": education,
        "Marital Status": marital_status,
        "Number of Dependents": dependents,
        "Property Area": property_area
    })
    
    # Calculate target (Loan Status: Approved=1, Rejected=0) based on realistic credit metrics + noise
    # We will compute Debt-to-Income and EMI to use in target assignment
    r = 0.10 / 12  # 10% annual interest
    emi = df.apply(
        lambda row: (row["Loan Amount"] * r * (1 + r)**row["Loan Term"]) / ((1 + r)**row["Loan Term"] - 1)
        if row["Loan Term"] > 0 else row["Loan Amount"],
        axis=1
    )
    
    dti = df["Existing Debt"] / df["Income"]
    emi_burden = emi / df["Income"]
    
    # Scoring formula: higher is better
    score = (
        (df["Credit Score"] - 300) / 550 * 50  # up to 50 pts
        + (df["Income"] / 25000) * 20          # up to 20 pts
        - (dti * 15)                           # penalize high debt-to-income
        - (emi_burden * 25)                    # penalize high monthly burden
        - (df["Existing Debt"] / 50000 * 10)   # penalize absolute debt
    )
    
    # Adjust for employment
    score = score + np.select(
        [
            df["Employment Status"] == "Employed",
            df["Employment Status"] == "Self-Employed",
            df["Employment Status"] == "Student",
            df["Employment Status"] == "Unemployed"
        ],
        [15, 8, -5, -20],
        default=0
    )
    
    # Add dependents penalty
    score = score - df["Number of Dependents"] * 3
    
    # Area adjustments
    score = score + np.select(
        [df["Property Area"] == "Semi-Urban", df["Property Area"] == "Urban", df["Property Area"] == "Rural"],
        [5, 2, -2],
        default=0
    )
    
    # Convert to probability and status
    approval_prob = 1 / (1 + np.exp(-0.1 * (score - 15))) # Sigmoid centered around score=15
    loan_status = (approval_prob > 0.5).astype(int)
    
    # Add 8% random noise to make ML learning realistic
    noise_mask = np.random.rand(n_samples) < 0.08
    loan_status[noise_mask] = 1 - loan_status[noise_mask]
    
    df["Loan Status"] = loan_status
    df.to_csv(csv_path, index=False)
    
    # Add to DB
    database.add_dataset("sample_credit_risk.csv", csv_path, n_samples)
    print("Synthetic dataset generated and loaded into DB.")
    return csv_path

def calculate_engineered_features(df):
    """
    Computes Debt-to-Income, EMI Burden, and Credit Utilization.
    """
    # Create a copy to prevent warnings
    df_feat = df.copy()
    
    # 1. Debt-to-Income Ratio (DTI)
    df_feat["Debt_to_Income_Ratio"] = df_feat["Existing Debt"] / df_feat["Income"]
    
    # 2. EMI Burden
    r = 0.10 / 12  # Assume 10% annual interest
    emi = df_feat.apply(
        lambda row: (row["Loan Amount"] * r * (1 + r)**row["Loan Term"]) / ((1 + r)**row["Loan Term"] - 1)
        if row["Loan Term"] > 0 else row["Loan Amount"],
        axis=1
    )
    df_feat["EMI_Burden"] = emi / df_feat["Income"]
    
    # 3. Credit Utilization
    # Estimate credit limit as Credit Score * 25
    credit_limit = df_feat["Credit Score"] * 25
    df_feat["Credit_Utilization"] = df_feat["Existing Debt"] / credit_limit
    
    return df_feat

def preprocess_dataset(df, selected_features=None, fit_preprocessors=True, preprocessor_state=None):
    """
    Preprocesses dataset by handling missing values, encoding, scaling and feature engineering.
    """
    # 1. Feature engineering first
    df_engineered = calculate_engineered_features(df)
    
    # 2. Missing Value Imputation
    # Numerical
    num_cols = df_engineered.select_dtypes(include=[np.number]).columns.tolist()
    if "Loan Status" in num_cols:
        num_cols.remove("Loan Status")
        
    # Categorical
    cat_cols = df_engineered.select_dtypes(include=[object, "category"]).columns.tolist()
    
    if fit_preprocessors:
        medians = {col: df_engineered[col].median() for col in num_cols}
        modes = {col: df_engineered[col].mode()[0] if not df_engineered[col].mode().empty else "" for col in cat_cols}
        preprocessor_state = {"medians": medians, "modes": modes}
    else:
        medians = preprocessor_state["medians"]
        modes = preprocessor_state["modes"]
        
    for col in num_cols:
        df_engineered[col] = df_engineered[col].fillna(medians.get(col, 0))
    for col in cat_cols:
        df_engineered[col] = df_engineered[col].fillna(modes.get(col, ""))
        
    # 3. Encoding Categorical columns
    # We will do standard manual dummy encoding to keep full control over columns
    if fit_preprocessors:
        # Save unique categories for one-hot encoding
        categories = {}
        for col in cat_cols:
            categories[col] = df_engineered[col].unique().tolist()
        preprocessor_state["categories"] = categories
    else:
        categories = preprocessor_state["categories"]
        
    # Process categorical columns by mapping into dummy indicator variables
    df_encoded = df_engineered.copy()
    encoded_columns = []
    
    for col in cat_cols:
        for val in categories.get(col, []):
            dummy_col = f"{col}_{val}"
            df_encoded[dummy_col] = (df_encoded[col] == val).astype(int)
            encoded_columns.append(dummy_col)
            
    # Drop original categorical columns
    df_encoded = df_encoded.drop(columns=cat_cols)
    
    # Columns available after preprocessing
    all_feature_cols = [col for col in df_encoded.columns if col != "Loan Status"]
    
    # If selected_features is provided, we filter down to that subset of features
    # Wait, the admin selects from original features. We map original feature names to encoded features!
    if selected_features:
        final_features = []
        for orig in selected_features:
            if orig in cat_cols:
                # Add all dummy variables for this category
                for val in categories.get(orig, []):
                    dummy_col = f"{orig}_{val}"
                    if dummy_col in df_encoded.columns:
                        final_features.append(dummy_col)
            else:
                if orig in df_encoded.columns:
                    final_features.append(orig)
                    
        # Always make sure engineered features are added if selected, or add them by default
        # If DTI/EMI/Utilization are selected or not in selected_features, let's keep them if requested
        for eng in ["Debt_to_Income_Ratio", "EMI_Burden", "Credit_Utilization"]:
            if eng in selected_features and eng in df_encoded.columns:
                final_features.append(eng)
    else:
        final_features = all_feature_cols
        
    # Reorder/filter dataframe columns
    X = df_encoded[final_features]
    
    y = None
    if "Loan Status" in df_encoded.columns:
        y = df_encoded["Loan Status"]
        
    # 4. Scaling numerical columns
    # Find which of the final features are numerical (non-binary dummy columns)
    scale_cols = []
    for col in final_features:
        # If it's not a dummy column and not binary, scale it
        # Simple test: is it in the original num_cols? Or is it an engineered feature?
        if col in num_cols or col in ["Debt_to_Income_Ratio", "EMI_Burden", "Credit_Utilization"]:
            scale_cols.append(col)
            
    if fit_preprocessors:
        scaler = StandardScaler()
        if len(scale_cols) > 0:
            scaler.fit(X[scale_cols])
        preprocessor_state["scaler"] = scaler
        preprocessor_state["scale_cols"] = scale_cols
        preprocessor_state["final_features"] = final_features
    else:
        scaler = preprocessor_state["scaler"]
        scale_cols = preprocessor_state["scale_cols"]
        
    X_scaled = X.copy()
    if len(scale_cols) > 0:
        X_scaled[scale_cols] = scaler.transform(X[scale_cols])
        
    return X_scaled, y, preprocessor_state

def train_all_models(selected_features=None):
    """
    Loads active dataset, preprocesses, trains multiple models, compares them, 
    and saves the best one.
    """
    active_ds = database.get_active_dataset()
    if not active_ds:
        # Generate sample dataset if none exists
        csv_path = generate_sample_dataset()
        active_ds = database.get_active_dataset()
    else:
        csv_path = active_ds["filepath"]
        
    df = pd.read_csv(csv_path)
    
    # Split features and target
    X, y, state = preprocess_dataset(df, selected_features=selected_features, fit_preprocessors=True)
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)
    
    models = {
        "Logistic Regression": LogisticRegression(max_iter=1000, random_state=42),
        "Decision Tree": DecisionTreeClassifier(random_state=42),
        "Random Forest": RandomForestClassifier(n_estimators=100, random_state=42),
        "XGBoost": XGBClassifier(n_estimators=100, random_state=42, eval_metric="logloss")
    }
    
    comparison = {}
    best_f1 = -1
    best_model_name = None
    best_model_obj = None
    
    for name, model in models.items():
        # Train
        model.fit(X_train, y_train)
        
        # Predict
        preds = model.predict(X_test)
        
        # Calculate proba for ROC-AUC
        if hasattr(model, "predict_proba"):
            probs = model.predict_proba(X_test)[:, 1]
        else:
            probs = preds
            
        acc = accuracy_score(y_test, preds)
        prec = precision_score(y_test, preds, zero_division=0)
        rec = recall_score(y_test, preds, zero_division=0)
        f1 = f1_score(y_test, preds, zero_division=0)
        
        try:
            auc = roc_auc_score(y_test, probs)
        except Exception:
            auc = 0.5
            
        comparison[name] = {
            "accuracy": round(float(acc), 4),
            "precision": round(float(prec), 4),
            "recall": round(float(rec), 4),
            "f1_score": round(float(f1), 4),
            "roc_auc": round(float(auc), 4)
        }
        
        # Pick best model based on F1 Score
        if f1 > best_f1:
            best_f1 = f1
            best_model_name = name
            best_model_obj = model
            
    # Calculate feature importances from the best model or Random Forest
    importance_model = models["Random Forest"] # Random Forest is always excellent for feature importance
    importances = importance_model.feature_importances_
    features = X.columns.tolist()
    
    # Map back to original features (combine dummy columns)
    feature_ranking = {}
    for f, imp in zip(features, importances):
        # find original name by stripping _val
        orig_name = f
        if "_" in f:
            # check if it is part of a category in state
            for cat_col in state["categories"]:
                if f.startswith(f"{cat_col}_"):
                    orig_name = cat_col
                    break
        feature_ranking[orig_name] = feature_ranking.get(orig_name, 0.0) + float(imp)
        
    sorted_importances = [{"feature": k, "importance": round(v, 4)} for k, v in sorted(feature_ranking.items(), key=lambda x: x[1], reverse=True)]
    
    # Save the best model details to DB
    best_metrics = comparison[best_model_name]
    
    # Save model binary
    saved_model_package = {
        "model_name": best_model_name,
        "model": best_model_obj,
        "preprocessor_state": state,
        "metrics": best_metrics,
        "features": features
    }
    
    save_serialized_model(saved_model_package, MODEL_PATH)
    
    # Save model details in database
    database.save_model(
        name=best_model_name,
        accuracy=best_metrics["accuracy"],
        precision=best_metrics["precision"],
        recall=best_metrics["recall"],
        f1_score=best_metrics["f1_score"],
        roc_auc=best_metrics["roc_auc"],
        selected_features=selected_features if selected_features else list(df.columns.drop("Loan Status")),
        filepath=MODEL_PATH
    )
    
    return {
        "comparison": comparison,
        "best_model": best_model_name,
        "feature_importances": sorted_importances
    }

def get_eda_data():
    """
    Generates statistics for Exploratory Data Analysis.
    """
    active_ds = database.get_active_dataset()
    if not active_ds:
        generate_sample_dataset()
        active_ds = database.get_active_dataset()
        
    df = pd.read_csv(active_ds["filepath"])
    
    # 1. Loan Approval Distribution
    approval_counts = df["Loan Status"].value_counts().to_dict()
    approval_dist = [
        {"name": "Approved", "value": int(approval_counts.get(1, 0))},
        {"name": "Rejected", "value": int(approval_counts.get(0, 0))}
    ]
    
    # 2. Risk Distribution
    # Group credit scores into Risk Tiers: Low Risk (720-850), Medium (600-719), High (<600)
    risk_tiers = pd.cut(df["Credit Score"], bins=[0, 599, 719, 900], labels=["High Risk", "Medium Risk", "Low Risk"])
    risk_counts = risk_tiers.value_counts().to_dict()
    risk_dist = [
        {"name": "Low Risk", "value": int(risk_counts.get("Low Risk", 0))},
        {"name": "Medium Risk", "value": int(risk_counts.get("Medium Risk", 0))},
        {"name": "High Risk", "value": int(risk_counts.get("High Risk", 0))}
    ]
    
    # 3. Income vs Loan Amount (average loan amount by income brackets)
    income_bins = pd.qcut(df["Income"], q=5, labels=["Very Low", "Low", "Medium", "High", "Very High"])
    income_vs_loan = df.groupby(income_bins, observed=False)["Loan Amount"].mean().reset_index()
    income_vs_loan_list = [
        {"income": row["Income"], "avg_loan": round(float(row["Loan Amount"]), 2)}
        for _, row in income_vs_loan.iterrows()
    ]
    
    # 4. Credit Score distribution (Histogram bins of size 50)
    score_bins = pd.cut(df["Credit Score"], bins=range(300, 900, 50))
    score_dist = score_bins.value_counts().sort_index().reset_index()
    score_dist_list = [
        {"range": f"{row['Credit Score'].left}-{row['Credit Score'].right}", "count": int(row["count"])}
        for _, row in score_dist.iterrows()
    ]
    
    # 5. Default rate (rejection rate) by employment status
    # Wait, rejection rate = Rejections / Total
    rejections = df[df["Loan Status"] == 0].groupby("Employment Status").size()
    totals = df.groupby("Employment Status").size()
    default_rate = (rejections / totals * 100).fillna(0).reset_index()
    default_rate.columns = ["Employment Status", "Rate"]
    default_rate_list = [
        {"status": row["Employment Status"], "rate": round(float(row["Rate"]), 2)}
        for _, row in default_rate.iterrows()
    ]
    
    # 6. Correlation Heatmap (only numerical columns)
    num_df = df.select_dtypes(include=[np.number])
    corr_matrix = num_df.corr().round(2).fillna(0)
    corr_list = []
    cols = corr_matrix.columns.tolist()
    for i, col1 in enumerate(cols):
        for j, col2 in enumerate(cols):
            corr_list.append({
                "x": col1,
                "y": col2,
                "val": float(corr_matrix.iloc[i, j])
            })
            
    return {
        "approval_distribution": approval_dist,
        "risk_distribution": risk_dist,
        "income_vs_loan": income_vs_loan_list,
        "credit_score_distribution": score_dist_list,
        "default_rate_by_employment": default_rate_list,
        "correlation_heatmap": {
            "columns": cols,
            "values": corr_list
        }
    }

def get_feature_info():
    """
    Computes summary distribution statistics for engineered features.
    """
    active_ds = database.get_active_dataset()
    if not active_ds:
        generate_sample_dataset()
        active_ds = database.get_active_dataset()
        
    df = pd.read_csv(active_ds["filepath"])
    df_feat = calculate_engineered_features(df)
    
    # Summaries of engineered columns
    dti_mean = df_feat["Debt_to_Income_Ratio"].mean()
    emi_mean = df_feat["EMI_Burden"].mean()
    util_mean = df_feat["Credit_Utilization"].mean()
    
    # List features available for training
    features_list = df.columns.drop("Loan Status").tolist()
    # Add engineered features to the list of choices
    features_list.extend(["Debt_to_Income_Ratio", "EMI_Burden", "Credit_Utilization"])
    
    return {
        "features": features_list,
        "averages": {
            "debt_to_income": round(float(dti_mean), 4),
            "emi_burden": round(float(emi_mean), 4),
            "credit_utilization": round(float(util_mean), 4)
        }
    }

def run_predictions(data):
    """
    Applies the active model to predict loan status, risk score, 
    risk tier, and dynamic explanation reasons.
    """
    if not os.path.exists(MODEL_PATH):
        # Trigger model training automatically if no model binary exists
        train_all_models()
        
    pkg = load_serialized_model(MODEL_PATH)
    model = pkg["model"]
    state = pkg["preprocessor_state"]
    features = pkg["features"]
    
    # Create single-row DataFrame matching input format
    raw_df = pd.DataFrame([data])
    
    # Preprocess using the saved fitting state
    X_single, _, _ = preprocess_dataset(
        raw_df, 
        selected_features=None, 
        fit_preprocessors=False, 
        preprocessor_state=state
    )
    
    # Align columns to match the trained features exactly
    for col in features:
        if col not in X_single.columns:
            X_single[col] = 0
            
    X_single = X_single[features]
    
    # Execute Prediction
    pred_label = int(model.predict(X_single)[0])
    
    if hasattr(model, "predict_proba"):
        prob_approved = float(model.predict_proba(X_single)[0][1])
    else:
        prob_approved = 1.0 if pred_label == 1 else 0.0
        
    # Translate label
    prediction = "Approved" if pred_label == 1 else "Rejected"
    
    # Core credit risk indicators
    income = float(data["Income"])
    existing_debt = float(data["Existing Debt"])
    loan_amount = float(data["Loan Amount"])
    loan_term = int(data["Loan Term"])
    credit_score = int(data["Credit Score"])
    
    dti = existing_debt / income if income > 0 else 0
    
    # EMI calculation
    r = 0.10 / 12
    emi = (loan_amount * r * (1 + r)**loan_term) / ((1 + r)**loan_term - 1) if loan_term > 0 else loan_amount
    emi_burden = emi / income if income > 0 else 0
    
    credit_limit = credit_score * 25
    utilization = existing_debt / credit_limit if credit_limit > 0 else 0
    
    # Calculate continuous Risk Score (0-100) based on credit risk formulas
    # We want Risk Score to represent probability of Default (or higher risk)
    # Risk Score = 100 - Approval Probability% is a very good base, modified by key triggers
    risk_score = (1 - prob_approved) * 100
    
    # Classify Risk Tier
    if risk_score < 30:
        risk_class = "Low Risk"
        badge_explanation = "The applicant has strong financial capacity, a solid credit history, and manageable existing debt. Approval is highly recommended."
    elif risk_score < 70:
        risk_class = "Medium Risk"
        badge_explanation = "The applicant has moderate credit health or slightly elevated debt service metrics. Review contributing factors before final authorization."
    else:
        risk_class = "High Risk"
        badge_explanation = "Significant risk indicators detected: low credit score, high debt ratios, or substantial EMI burden relative to monthly income."
        
    # Analyze contributing factors
    pos_factors = []
    neg_factors = []
    
    # Credit Score factor
    if credit_score >= 720:
        pos_factors.append(f"Excellent Credit Score ({credit_score}) indicates outstanding history of repayment.")
    elif credit_score >= 600:
        pos_factors.append(f"Fair Credit Score ({credit_score}) demonstrates acceptable credit standing.")
    else:
        neg_factors.append(f"Poor Credit Score ({credit_score}) represents elevated risk of delinquency.")
        
    # DTI factor
    if dti <= 0.20:
        pos_factors.append(f"Healthy Debt-to-Income Ratio ({round(dti*100, 1)}%) leaves substantial disposable budget.")
    elif dti > 0.45:
        neg_factors.append(f"High Debt-to-Income Ratio ({round(dti*100, 1)}%) limits room for additional borrowing.")
        
    # EMI Burden factor
    if emi_burden <= 0.15:
        pos_factors.append(f"Low EMI-to-Income burden ({round(emi_burden*100, 1)}%) indicates comfortable repayment capacity.")
    elif emi_burden > 0.40:
        neg_factors.append(f"Heavy EMI Burden ({round(emi_burden*100, 1)}% of income) suggests potential strain in debt servicing.")
        
    # Credit Utilization factor
    if utilization < 0.30:
        pos_factors.append(f"Low Credit Utilization ({round(utilization*100, 1)}%) shows disciplined credit consumption.")
    elif utilization > 0.70:
        neg_factors.append(f"High Credit Utilization ({round(utilization*100, 1)}%) indicates heavy reliance on credit lines.")
        
    # Employment factor
    if data["Employment Status"] == "Employed":
        pos_factors.append("Stable monthly salary as a full-time salaried employee.")
    elif data["Employment Status"] == "Unemployed":
        neg_factors.append("Current unemployment introduces severe income volatility risks.")
        
    # Default fallback explanations
    if not pos_factors:
        pos_factors.append("Applicant has standard baseline credit parameters.")
    if not neg_factors:
        neg_factors.append("No critical credit risk warnings identified.")
        
    contributing_factors = {
        "positive": pos_factors,
        "negative": neg_factors,
        "dti_ratio": round(dti, 4),
        "emi_amount": round(emi, 2),
        "emi_burden": round(emi_burden, 4),
        "credit_utilization": round(utilization, 4)
    }
    
    return {
        "prediction": prediction,
        "probability": round(prob_approved * 100, 2),
        "risk_score": round(risk_score, 2),
        "risk_class": risk_class,
        "risk_explanation": badge_explanation,
        "contributing_factors": contributing_factors
    }

def map_kaggle_columns(df):
    """
    Detects common Kaggle column names for loan risk datasets and renames/transforms them
    to match our standard 13-column schema.
    """
    rename_dict = {}
    cols = df.columns.tolist()
    
    # Lowercase all to check matches
    col_lower = {c.lower().replace("_", "").replace(" ", ""): c for c in cols}
    
    # 1. Age
    if "age" in col_lower:
        rename_dict[col_lower["age"]] = "Age"
    elif "personage" in col_lower:
        rename_dict[col_lower["personage"]] = "Age"
        
    # 2. Gender
    if "gender" in col_lower:
        rename_dict[col_lower["gender"]] = "Gender"
    elif "sex" in col_lower:
        rename_dict[col_lower["sex"]] = "Gender"
        
    # 3. Income
    if "income" in col_lower:
        rename_dict[col_lower["income"]] = "Income"
    elif "personincome" in col_lower:
        rename_dict[col_lower["personincome"]] = "Income"
    elif "applicantincome" in col_lower:
        rename_dict[col_lower["applicantincome"]] = "Income"
        
    # 4. Employment Status
    if "employmentstatus" in col_lower:
        rename_dict[col_lower["employmentstatus"]] = "Employment Status"
    elif "employment" in col_lower:
        rename_dict[col_lower["employment"]] = "Employment Status"
    elif "personemplength" in col_lower:
        rename_dict[col_lower["personemplength"]] = "Employment Status"
        
    # 5. Loan Amount
    if "loanamount" in col_lower:
        rename_dict[col_lower["loanamount"]] = "Loan Amount"
    elif "loanamnt" in col_lower:
        rename_dict[col_lower["loanamnt"]] = "Loan Amount"
        
    # 6. Loan Term
    if "loanterm" in col_lower:
        rename_dict[col_lower["loanterm"]] = "Loan Term"
    elif "loantermmonths" in col_lower:
        rename_dict[col_lower["loantermmonths"]] = "Loan Term"
    elif "loan_amount_term" in col_lower:
        rename_dict[col_lower["loan_amount_term"]] = "Loan Term"
        
    # 7. Credit Score
    if "creditscore" in col_lower:
        rename_dict[col_lower["creditscore"]] = "Credit Score"
    elif "credithistory" in col_lower:
        rename_dict[col_lower["credithistory"]] = "Credit Score"
    elif "cbpersoncredhistlength" in col_lower:
        rename_dict[col_lower["cbpersoncredhistlength"]] = "Credit Score"
        
    # 8. Existing Debt
    if "existingdebt" in col_lower:
        rename_dict[col_lower["existingdebt"]] = "Existing Debt"
    elif "debt" in col_lower:
        rename_dict[col_lower["debt"]] = "Existing Debt"
        
    # 9. Education
    if "education" in col_lower:
        rename_dict[col_lower["education"]] = "Education"
        
    # 10. Marital Status
    if "maritalstatus" in col_lower:
        rename_dict[col_lower["maritalstatus"]] = "Marital Status"
    elif "married" in col_lower:
        rename_dict[col_lower["married"]] = "Marital Status"
        
    # 11. Dependents
    if "numberofdependents" in col_lower:
        rename_dict[col_lower["numberofdependents"]] = "Number of Dependents"
    elif "dependents" in col_lower:
        rename_dict[col_lower["dependents"]] = "Number of Dependents"
        
    # 12. Property Area
    if "propertyarea" in col_lower:
        rename_dict[col_lower["propertyarea"]] = "Property Area"
    elif "property_area" in col_lower:
        rename_dict[col_lower["property_area"]] = "Property Area"
        
    # 13. Loan Status (Target)
    if "loanstatus" in col_lower:
        rename_dict[col_lower["loanstatus"]] = "Loan Status"
    elif "loan_status" in col_lower:
        rename_dict[col_lower["loan_status"]] = "Loan Status"
        
    # Apply renames
    df_mapped = df.rename(columns=rename_dict)
    
    # Run specialized mappings / transformations for contents if they were renamed
    # Credit History (0 or 1) -> Credit Score (450 or 750)
    if "Credit Score" in df_mapped.columns:
        # If it's a binary credit history column (values <= 2), convert to numeric Credit Score
        if df_mapped["Credit Score"].max() <= 2:
            df_mapped["Credit Score"] = df_mapped["Credit Score"].apply(lambda x: 750 if x == 1 or x == 1.0 else 450)
            
    # CoapplicantIncome -> Sum to Income if exists
    co_inc_col = None
    for c in cols:
        if c.lower() == "coapplicantincome":
            co_inc_col = c
            break
    if co_inc_col and "Income" in df_mapped.columns:
        df_mapped["Income"] = df_mapped["Income"] + df_mapped[co_inc_col].fillna(0)
        
    # Fill remaining missing standard columns with reasonable defaults
    required_cols = {
        "Age": 30,
        "Gender": "Male",
        "Income": 5000.0,
        "Employment Status": "Employed",
        "Loan Amount": 30000.0,
        "Loan Term": 60,
        "Credit Score": 680,
        "Existing Debt": 2000.0,
        "Education": "Bachelor",
        "Marital Status": "Single",
        "Number of Dependents": 0,
        "Property Area": "Semi-Urban",
        "Loan Status": 1
    }
    
    for col, default_val in required_cols.items():
        if col not in df_mapped.columns:
            df_mapped[col] = default_val
            
    # Standardize data formats
    if df_mapped["Marital Status"].dtype in [np.number, bool]:
        df_mapped["Marital Status"] = df_mapped["Marital Status"].apply(lambda x: "Married" if x == 1 or x is True else "Single")
        
    if df_mapped["Employment Status"].dtype in [np.number]:
        df_mapped["Employment Status"] = df_mapped["Employment Status"].apply(lambda x: "Employed" if x > 0 else "Unemployed")
        
    # Loan Status: ensure it's binary 0/1
    if df_mapped["Loan Status"].dtype == object:
        df_mapped["Loan Status"] = df_mapped["Loan Status"].apply(lambda x: 1 if str(x).strip().lower() in ["y", "yes", "approved", "1", "true"] else 0)
    else:
        df_mapped["Loan Status"] = df_mapped["Loan Status"].fillna(1).astype(int)
        
    return df_mapped[list(required_cols.keys())]

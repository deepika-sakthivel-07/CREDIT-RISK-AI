import os
import sys
import json

# Ensure backend folder is in path
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

import database
import auth
import ml_pipeline

def main():
    print("==================================================")
    print("     STARTING CREDIT RISK BACKEND VERIFICATION   ")
    print("==================================================")
    
    # 1. Init Database
    print("\n[1/5] Initializing Database...")
    database.init_db()
    print("Database tables initialized successfully.")
    
    # 2. Check or Create Users
    print("\n[2/5] Creating Test Users...")
    admin_user = database.get_user_by_username("admin_test")
    if not admin_user:
        hashed = auth.get_password_hash("adminpwd")
        admin_user = database.create_user("admin_test", hashed, role="admin")
        print(f"Created Admin Test User: {admin_user}")
    else:
        print(f"Admin Test User already exists: {admin_user['username']}")
        
    normal_user = database.get_user_by_username("user_test")
    if not normal_user:
        hashed = auth.get_password_hash("userpwd")
        normal_user = database.create_user("user_test", hashed, role="user")
        print(f"Created Normal Test User: {normal_user}")
    else:
        print(f"Normal Test User already exists: {normal_user['username']}")
        
    # Verify Auth Password checking
    assert auth.verify_password("userpwd", normal_user["password_hash"] if "password_hash" in normal_user else database.get_user_by_username("user_test")["password_hash"])
    print("Auth password hashing verification: PASSED")
    
    # 3. Generate Dataset
    print("\n[3/5] Generating Synthetic Dataset...")
    csv_path = ml_pipeline.generate_sample_dataset()
    print(f"Dataset generated at: {csv_path}")
    active_ds = database.get_active_dataset()
    print(f"Active dataset in database: {active_ds['filename']} ({active_ds['row_count']} rows)")
    
    # 4. Train Models
    print("\n[4/5] Training Classifiers (Logistic Regression, Decision Tree, Random Forest, XGBoost)...")
    results = ml_pipeline.train_all_models()
    print(f"Best performing model selected: {results['best_model']}")
    print("\nModel Comparisons:")
    for model_name, metrics in results["comparison"].items():
        print(f" - {model_name}: F1={metrics['f1_score']}, Accuracy={metrics['accuracy']}, ROC-AUC={metrics['roc_auc']}")
        
    print("\nTop 5 Feature Importances:")
    for imp in results["feature_importances"][:5]:
        print(f" - {imp['feature']}: {imp['importance']}")
        
    # 5. Run Prediction Inference
    print("\n[5/5] Testing Real-time Inference Pipeline...")
    sample_application = {
        "full_name": "John Doe",
        "age": 35,
        "gender": "Male",
        "income": 8500.0,
        "employment_status": "Employed",
        "loan_amount": 45000.0,
        "loan_term": 60,
        "credit_score": 710,
        "existing_debt": 12000.0,
        "education": "Bachelor",
        "marital_status": "Married",
        "dependents": 2,
        "property_area": "Semi-Urban"
    }
    
    # Map input format
    ml_input = {
        "Age": sample_application["age"],
        "Gender": sample_application["gender"],
        "Income": sample_application["income"],
        "Employment Status": sample_application["employment_status"],
        "Loan Amount": sample_application["loan_amount"],
        "Loan Term": sample_application["loan_term"],
        "Credit Score": sample_application["credit_score"],
        "Existing Debt": sample_application["existing_debt"],
        "Education": sample_application["education"],
        "Marital Status": sample_application["marital_status"],
        "Number of Dependents": sample_application["dependents"],
        "Property Area": sample_application["property_area"]
    }
    
    prediction_results = ml_pipeline.run_predictions(ml_input)
    print("\nPrediction Output:")
    print(f" - Decision: {prediction_results['prediction']}")
    print(f" - Approval Probability: {prediction_results['probability']}%")
    print(f" - Risk Score: {prediction_results['risk_score']}/100")
    print(f" - Risk Category: {prediction_results['risk_class']}")
    print(f" - Risk Explanation: {prediction_results['risk_explanation']}")
    print("\nContributing Factors:")
    print("   [+] Positive Factors:")
    for factor in prediction_results["contributing_factors"]["positive"]:
        print(f"     * {factor}")
    print("   [-] Risk Factors:")
    for factor in prediction_results["contributing_factors"]["negative"]:
        print(f"     * {factor}")
        
    print("\n==================================================")
    print("       BACKEND CORE VERIFICATION: COMPLETED       ")
    print("==================================================")

if __name__ == "__main__":
    main()

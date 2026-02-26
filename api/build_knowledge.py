import pandas as pd
import json
import os

def build_knowledge_base():
    base_dir = r"C:\Users\sonam\Downloads\archive"
    
    # Load all datasets
    print("Loading datasets...")
    df_desc = pd.read_csv(os.path.join(base_dir, 'symptom_Description.csv'))
    df_prec = pd.read_csv(os.path.join(base_dir, 'symptom_precaution.csv'))
    df_data = pd.read_csv(os.path.join(base_dir, 'dataset.csv'))
    
    # 1. Map Descriptions
    descriptions = {}
    for _, row in df_desc.iterrows():
        disease = row['Disease'].strip()
        descriptions[disease] = str(row['Description']).strip()

    # 2. Map Precautions
    precautions = {}
    for _, row in df_prec.iterrows():
        disease = row['Disease'].strip()
        precs = []
        for i in range(1, 5):
            val = row[f'Precaution_{i}']
            if pd.notna(val) and str(val).strip():
                precs.append(str(val).strip().capitalize())
        precautions[disease] = precs

    # 3. Extract unique symptoms per disease from main dataset
    disease_symptoms = {}
    for _, row in df_data.iterrows():
        disease = row['Disease'].strip()
        
        # Initialize if not present
        if disease not in disease_symptoms:
            disease_symptoms[disease] = set()
            
        # Get all symptoms for this row
        for i in range(1, 18):
            val = row.get(f'Symptom_{i}')
            if pd.notna(val) and str(val).strip():
                # Clean the symptom string (e.g. ' continuous_sneezing' -> 'Continuous sneezing')
                symptom = str(val).strip().replace('_', ' ').capitalize()
                disease_symptoms[disease].add(symptom)

    # Convert sets to sorted lists for deterministic output
    for disease in disease_symptoms:
        disease_symptoms[disease] = sorted(list(disease_symptoms[disease]))

    # Combine everything into a text knowledge base
    print("Building knowledge base text file...")
    lines = []
    lines.append("=== MED-AI CLINICAL KNOWLEDGE BASE ===")
    lines.append("This is the trusted source of truth for disease diagnostics. Use ONLY this information when making medical assessments.")
    lines.append("\n")

    sorted_diseases = sorted(list(disease_symptoms.keys()))
    
    for d in sorted_diseases:
        lines.append(f"DISEASE: {d}")
        
        desc = descriptions.get(d, "No description available.")
        lines.append(f"DESCRIPTION: {desc}")
        
        symps = ", ".join(disease_symptoms[d])
        lines.append(f"COMMON SYMPTOMS: {symps}")
        
        precs = precautions.get(d, [])
        if precs:
            precs_str = ", ".join(precs)
            lines.append(f"RECOMMENDED PRECAUTIONS/TREATMENTS: {precs_str}")
        else:
            lines.append("RECOMMENDED PRECAUTIONS/TREATMENTS: Consult a healthcare professional.")
            
        lines.append("-" * 40)

    # Write to a file in the API directory
    output_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "medical_knowledge_base.txt")
    with open(output_path, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
        
    print(f"Knowledge base successfully created at: {output_path}")

if __name__ == "__main__":
    build_knowledge_base()

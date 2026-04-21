import pandas as pd
import json
import math

df = pd.read_excel('2025 BATCH LIST FOR AUCTION .xlsx')
df = df.dropna(how='all', axis=0).dropna(how='all', axis=1)
df = df.fillna('')

# Convert to records
records = df.to_dict(orient='records')

with open('data.js', 'w', encoding='utf-8') as f:
    f.write('const studentData = ' + json.dumps(records) + ';\n')

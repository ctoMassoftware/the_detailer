#!/usr/bin/env python3
import json
import base64
import http.client

# Credenciales de LabsMobile
LABSMOBILE_USERNAME = 'cto@massoftware.co'
LABSMOBILE_API_TOKEN = 'fbmU0QMy227xlc1VDGop6jbcbOkG70Yb'
LABSMOBILE_SENDER = 'The Detailer'

# Número a probar
phone_number = '+573117899331'
message = 'Visitanos en celuweb: https://celuweb.com'

print('📱 Enviando SMS con link...\n')
print(f'Número: {phone_number}')
print(f'Mensaje: {message}\n')

# Preparar datos
data = {
    'message': message,
    'tpoa': LABSMOBILE_SENDER,
    'recipient': [
        {
            'msisdn': phone_number
        }
    ]
}

json_data = json.dumps(data)

# Preparar autenticación
auth_string = f'{LABSMOBILE_USERNAME}:{LABSMOBILE_API_TOKEN}'
auth_bytes = base64.b64encode(auth_string.encode()).decode()

# Headers
headers = {
    'Content-Type': 'application/json',
    'Authorization': f'Basic {auth_bytes}'
}

print('🔄 Enviando...\n')

conn = http.client.HTTPSConnection('api.labsmobile.com')
conn.request('POST', '/json/send', json_data, headers)

response = conn.getresponse()
response_data = response.read().decode()

try:
    response_json = json.loads(response_data)
    print(json.dumps(response_json, indent=2))

    if response_json.get('code') == '0':
        print('\n✅ SMS ENVIADO EXITOSAMENTE')
        print(f"SubID: {response_json.get('subid')}")
    else:
        print(f"\n❌ ERROR: [{response_json.get('code')}] {response_json.get('message')}")
except:
    print('Raw response:')
    print(response_data)

conn.close()

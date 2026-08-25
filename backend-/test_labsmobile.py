#!/usr/bin/env python3
import json
import base64
import http.client

# Credenciales de LabsMobile
LABSMOBILE_USERNAME = 'cto@massoftware.co'
LABSMOBILE_API_TOKEN = 'fbmU0QMy227xlc1VDGop6jbcbOkG70Yb'
LABSMOBILE_SENDER = 'The Detailer'

# Número a probar
phone_number = '+573108030240'
message = """¡Hola! 👋
━━━━━━━━━━━━━━━━━━━
🎉 ¡Tu vehículo está LISTO!
Estatus: DISPONIBLE PARA RECOGER

💰 Valor total: $25,000

📋 Descarga tu recibo adjunto
🏪 Ven a recoger tu orden
¡Gracias por tu preferencia! 👌
━━━━━━━━━━━━━━━━━━━
📍 The Detailer
⏰ Horario: Lunes-Viernes 8am-6pm"""

print('📱 Iniciando prueba de LabsMobile...\n')
print(f'Username: {LABSMOBILE_USERNAME}')
print(f'Token: {LABSMOBILE_API_TOKEN[:10]}...')
print(f'Sender: {LABSMOBILE_SENDER}')
print(f'Destino: {phone_number}\n')

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

print('🔄 Enviando solicitud a LabsMobile...\n')

conn = http.client.HTTPSConnection('api.labsmobile.com')
conn.request('POST', '/json/send', json_data, headers)

response = conn.getresponse()
response_data = response.read().decode()

print('📬 Respuesta de LabsMobile:\n')
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

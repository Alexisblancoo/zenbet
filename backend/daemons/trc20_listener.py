import time
import requests
import psycopg2

# Configuración de la red y credenciales de la casa
TRONGRID_API_URL = "https://api.trongrid.io/v1/accounts"
USDT_CONTRACT_ADDRESS = "TR7NHqjeKQxGTCi8q8ZY4pL8otSzgjLj6t" # Contrato oficial USDT en Tron
WALLET_CASA = "TU_WALLET_TRON_DE_LA_CASA_AQUI" # Reemplaza con tu dirección

def get_db_connection():
    return psycopg2.connect(
        dbname="zenbet",
        user="postgres",
        password="tu_password", # Cambia por tu contraseña local
        host="localhost",
        port="5432"
    )

def fetch_recent_usdt_transfers(wallet_address):
    """Consulta la API de TronGrid para obtener las últimas transferencias TRC20 de USDT."""
    url = f"{TRONGRID_API_URL}/{wallet_address}/transactions/trc20"
    params = {
        "contract_address": USDT_CONTRACT_ADDRESS,
        "limit": 20,
        "order_by": "block_timestamp,desc"
    }
    
    headers = {
        "accept": "application/json"
        # Opcional: "TRON-PRO-API-KEY": "tu_api_key_de_trongrid" si tienes una clave para mayor límite
    }

    try:
        response = requests.get(url, params=params, headers=headers, timeout=10)
        if response.status_code == 200:
            return response.json().get("data", [])
    except requests.exceptions.RequestException as e:
        print(f"[!] Error de red al conectar con TronGrid: {e}")
    
    return []

def listen_to_trc20_transfers(seen_hashes):
    print(f"[*] Iniciando radar de mempool TRC20 para la wallet: {WALLET_CASA}...")
    
    db_conn = get_db_connection()

    while True:
        try:
            transfers = fetch_recent_usdt_transfers(WALLET_CASA)
            
            for tx in transfers:
                tx_id = tx.get("transaction_id")
                from_addr = tx.get("from")
                to_addr = tx.get("to")
                
                # El valor viene en unidades crudas de 6 decimales para USDT
                raw_value = int(tx.get("value", 0))
                amount = raw_value / (10 ** 6)

                # Validar si es un depósito entrante a nuestra wallet y no ha sido procesado
                if to_addr.lower() == WALLET_CASA.lower() and tx_id not in seen_hashes:
                    seen_hashes.add(tx_id)
                    insert_deposit(tx_id, from_addr, amount, db_conn)
                    print(f"[+] Depósito detectado y acreditado: {amount} USDT | TxID: {tx_id}")

        except Exception as e:
            print(f"[!] Error en el ciclo del daemon: {e}")
            # Reintentar conexión a BD si se cayó
            try:
                db_conn.close()
            except:
                pass
            db_conn = get_db_connection()

        # Pausa estricta de 5 segundos para evitar saturar la API
        time.sleep(5)

def insert_deposit(tx_id, from_addr, amount, db_conn):
    cursor = db_conn.cursor()
    try:
        query = """
            INSERT INTO depositos_crypto (tx_id, from_addr, amount, status, created_at) 
            VALUES (%s, %s, %s, 'confirmed', NOW())
            ON CONFLICT (tx_id) DO NOTHING
        """
        cursor.execute(query, (tx_id, from_addr, amount))
        db_conn.commit()
    except Exception as e:
        db_conn.rollback()
        print(f"[!] Error al insertar depósito en la base de datos: {e}")
    finally:
        cursor.close()

def main():
    seen_hashes = set()
    
    # Precargar hashes existentes de la base de datos para evitar duplicados al reiniciar el script
    try:
        conn = get_db_connection()
        cur = conn.cursor()
        cur.execute("SELECT tx_id FROM depositos_crypto")
        rows = cur.fetchall()
        for row in rows:
            seen_hashes.add(row[0])
        cur.close()
        conn.close()
        print(f"[*] Se cargaron {len(seen_hashes)} hashes previos desde la base de datos.")
    except Exception as e:
        print(f"[!] No se pudieron precargar los hashes previos (la tabla quizás esté vacía): {e}")

    # Arrancar el daemon de escucha continua
    listen_to_trc20_transfers(seen_hashes)

if __name__ == '__main__':
    main()
<?php

class BetEngine {
    private static $instance = null;
    private $db;

    private function __construct($dsn, $username, $password) {
        $this->db = new PDO($dsn, $username, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    }

    public static function getInstance() {
        if (self::$instance === null) {
            // Configura aquí tus credenciales reales de PostgreSQL
            $dsn = 'pgsql:host=localhost;dbname=zenbet;charset=utf8';
            $username = 'postgres';
            $password = 'tu_password'; // Cambia por tu contraseña local
            self::$instance = new self($dsn, $username, $password);
        }
        return self::$instance;
    }

    // Método para obtener la conexión PDO de manera limpia
    public static function getPdo() {
        return self::getInstance()->db;
    }

    public static function registrar_apuesta($p_usuario_id, $p_evento_id, $p_monto, $p_cuota) {
        $db = self::getPdo();

        try {
            // 1. Iniciar la transacción ATÓMICA antes del bloqueo
            $db->beginTransaction();

            // 2. Bloquear y verificar saldo de forma concurrente
            $stmt = $db->prepare('SELECT balance FROM usuarios WHERE id = :user_id FOR UPDATE');
            $stmt->execute(['user_id' => $p_usuario_id]);
            $user = $stmt->fetch();

            if (!$user) {
                $db->rollBack();
                return ['status' => 'error', 'message' => 'Usuario no encontrado'];
            }

            if ($user['balance'] < $p_monto) {
                $db->rollBack();
                return ['status' => 'error', 'message' => 'Saldo insuficiente'];
            }

            // 3. Descontar el stake del balance del usuario
            $stmt = $db->prepare('UPDATE usuarios SET balance = balance - :monto WHERE id = :user_id');
            $stmt->execute(['user_id' => $p_usuario_id, 'monto' => $p_monto]);

            // 4. Registrar el movimiento en la tabla ledger contable
            $new_balance = $user['balance'] - $p_monto;
            $stmt = $db->prepare('INSERT INTO ledger (user_id, event_id, monto, balance) VALUES (:user_id, :event_id, :monto, :new_balance)');
            $stmt->execute([
                'user_id' => $p_usuario_id, 
                'event_id' => $p_evento_id, 
                'monto' => $p_monto, 
                'new_balance' => $new_balance
            ]);

            // Confirmar transacción de forma exitosa
            $db->commit();
            return ['status' => 'success', 'new_balance' => $new_balance];

        } catch (PDOException $e) {
            if ($db->inTransaction()) {
                $db->rollBack();
            }
            return ['status' => 'error', 'message' => 'Error de transacción: ' . $e->getMessage()];
        }
    }
}
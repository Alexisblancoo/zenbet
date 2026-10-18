<?php

class ShadowBanningEngine {
    private $db;

    public function __construct($dsn = null, $username = null, $password = null) {
        // Usa la conexión pasada o toma la por defecto de Zenbet
        $dsn = $dsn ?? 'pgsql:host=localhost;dbname=zenbet;charset=utf8';
        $username = $username ?? 'postgres';
        $password = $password ?? 'tu_password';

        $this->db = new PDO($dsn, $username, $password, [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC
        ]);
    }

    public function process_apost($apost) {
        // 1. Inyección de Latencia Fantasma (3 a 7 segundos)
        sleep(mt_rand(3, 7));

        $effective_odds = (float)$apost['odds'];

        // 2. Evaluación de riesgo y Deslizamiento de Cuotas Hostil (-5%)
        if ($this->checkSureBet($apost) || $this->checkValueExtreme($apost)) {
            $effective_odds *= 0.95;
        }

        // Formatear cuota a 2 decimales y garantizar mínimo de 1.01
        $effective_odds = max(1.01, round($effective_odds, 2));

        // 3. Auditoría en la tabla oculta
        $this->logAuditEvent($apost['device_id'], $effective_odds, $apost['user_id'] ?? null);

        // 4. Retornar la cuota efectiva procesada
        return $effective_odds;
    }

    private function checkSureBet($apost) {
        if (empty($apost['device_id'])) {
            return false;
        }

        // Caza ráfagas: más de 3 apuestas en los últimos 10 segundos desde el mismo dispositivo
        $stmt = $this->db->prepare('
            SELECT COUNT(*) as total 
            FROM audit_shadow_banned 
            WHERE device_id = :device_id 
            AND created_at >= (NOW() - INTERVAL \'10 seconds\')
        ');
        $stmt->execute(['device_id' => $apost['device_id']]);
        $total = $stmt->fetchColumn();

        return ($total >= 3);
    }

    private function checkValueExtreme($apost) {
        if (empty($apost['user_id'])) {
            return false;
        }

        // Calcula el promedio histórico de apuestas en la tabla ledger
        $stmt = $this->db->prepare('
            SELECT COALESCE(AVG(monto), 0) as avg_monto 
            FROM ledger 
            WHERE user_id = :user_id
        ');
        $stmt->execute(['user_id' => $apost['user_id']]);
        $avg_monto = (float)$stmt->fetchColumn();

        // Alerta si la apuesta supera en 5x el promedio histórico del usuario
        if ($avg_monto > 0 && $apost['amount'] > ($avg_monto * 5)) {
            return true;
        }

        return false;
    }

    private function logAuditEvent($device_id, $effective_odds, $user_id) {
        $stmt = $this->db->prepare('
            INSERT INTO audit_shadow_banned (device_id, user_id, effective_odds, created_at) 
            VALUES (:device_id, :user_id, :effective_odds, NOW())
        ');
        $stmt->execute([
            'device_id' => $device_id,
            'user_id' => $user_id,
            'effective_odds' => $effective_odds
        ]);
    }
}
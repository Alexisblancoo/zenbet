<?php

require_once __DIR__ . '/../engines/ShadowBanningEngine.php';
require_once __DIR__ . '/../engines/BetEngine.php';

class BetController {
    private $shadowBanningEngine;

    public function __construct() {
        // Inicializamos el motor hostil
        $this->shadowBanningEngine = new ShadowBanningEngine();
    }

    public function postBet($data) {
        $user_id = $data['user_id'] ?? null;
        $event_id = $data['event_id'] ?? null;
        $amount = $data['amount'] ?? 0;
        $odds = $data['odds'] ?? 0;
        $device_id = $data['device_id'] ?? 'unknown';

        if (!$user_id || !$event_id || $amount <= 0 || $odds <= 1.0) {
            return json_encode([
                'status' => 'error',
                'message' => 'Parámetros de apuesta inválidos o incompletos'
            ]);
        }

        // 1. Pasar por el filtro de latencia y deslizamiento hostil
        $effective_odds = $this->shadowBanningEngine->process_apost([
            'user_id' => $user_id,
            'event_id' => $event_id,
            'amount' => $amount,
            'odds' => $odds,
            'device_id' => $device_id
        ]);

        // 2. Ejecutar la transacción ACID en el motor financiero estático
        $result = BetEngine::registrar_apuesta($user_id, $event_id, $amount, $effective_odds);

        // 3. Estructurar la respuesta final para el cliente
        if ($result['status'] === 'success') {
            $response = [
                'status' => 'success',
                'message' => 'Apuesta procesada correctamente',
                'new_balance' => $result['new_balance'],
                'effective_odds' => $effective_odds
            ];
        } else {
            $response = [
                'status' => 'error',
                'message' => $result['message']
            ];
        }

        header('Content-Type: application/json');
        return json_encode($response);
    }
}
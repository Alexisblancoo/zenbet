<?php
header('Content-Type: application/json');

// 1. Validar que la petición sea estrictamente POST
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    http_response_code(405);
    echo json_encode(['status' => 'error', 'message' => 'Método HTTP inválido']);
    exit;
}

// 2. Leer el payload JSON enviado desde el frontend de React
$data = json_decode(file_get_contents('php://input'), true);

if (empty($data)) {
    http_response_code(400);
    echo json_encode(['status' => 'error', 'message' => 'Payload JSON inválido']);
    exit;
}

// 3. Requerir el controlador usando la ruta relativa correcta con __DIR__
require_once __DIR__ . '/../controllers/BetController.php';

// 4. Instanciar y procesar la solicitud
$betController = new BetController();
$response = $betController->postBet($data);

echo $response;
?>
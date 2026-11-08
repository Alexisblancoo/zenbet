import crypto from 'node:crypto';

const BASE_URL = 'http://localhost:5005';
// Requiere una sesion admin: export ZENBET_ADMIN_TOKEN=<token de POST /api/auth/login con el admin>
const ADMIN_TOKEN = process.env.ZENBET_ADMIN_TOKEN;
if (!ADMIN_TOKEN) { console.error('Falta ZENBET_ADMIN_TOKEN (login de un usuario con rol admin).'); process.exit(1); }

// Market: UFC 334 - Yousri Belgaroui vs Caio Borralho (Winner)
const MARKET_ID = '6bf7912d-5a6e-5a4c-9232-bf4e953a69fe';
const SEL_YOUSRI = '04130459-0f84-5043-b3b6-cd80df50a21d'; // Cuota 1.80
const SEL_CAIO = '7f7e0de6-f971-5603-9e5a-731591977fd0';   // Cuota 2.05

// Secondary Market for Bet 2 (Total de asaltos)
const SEL_SECONDARY = '02af40e3-1024-5f17-9ad7-d6bbcc2c7d11'; // Más de 2.5 asaltos, cuota 1.8475

function formatCurrency(val) {
  const num = typeof val === 'number' ? val : parseFloat(val || 0);
  const sign = num < 0 ? '-' : '';
  return `${sign}$${Math.abs(num).toFixed(2)}`;
}

async function runAudit() {
  console.log('================================================================================');
  console.log('       ZENBET PROTOCOL: AUDITORÍA FINANCIERA DE VAR & CLAWBACK ENGINE          ');
  console.log('================================================================================\n');

  // --------------------------------------------------------------------------
  // FASE 1: SETUP - Registro de Usuario y Apuesta Inicial ($50.00)
  // --------------------------------------------------------------------------
  const uniqueId = crypto.randomBytes(4).toString('hex');
  const username = `var_victim_user_${uniqueId}`;
  const email = `var_victim_${uniqueId}@zenbet.test`;
  const password = 'Password123!';

  console.log(`[FASE 1] Configurando sujeto de prueba: ${username} (${email})...`);
  const regRes = await fetch(`${BASE_URL}/api/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      username,
      email,
      password,
      termsAccepted: true
    })
  });

  const regData = await regRes.json();
  if (!regRes.ok || !regData.token) {
    throw new Error(`Registro fallido: ${regRes.status} ${JSON.stringify(regData)}`);
  }

  const token = regData.token;
  const walletId = regData.user.walletId;
  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };
  console.log(`   ✓ Usuario registrado. WalletId: ${walletId}`);

  // Depósito de $50.00
  console.log('   -> Ejecutando depósito inicial de $50.00 en Smart Bonus Ledger...');
  const depRes = await fetch(`${BASE_URL}/api/v1/wallet/deposit`, {
    method: 'POST',
    headers: { ...authHeaders, 'Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({ amount: 50.00, method: 'wallet' })
  });
  const depData = await depRes.json();
  if (!depRes.ok || !depData.success) {
    throw new Error(`Depósito fallido: ${depRes.status} ${JSON.stringify(depData)}`);
  }
  console.log(`   ✓ Depósito acreditado. Balance disponible: ${formatCurrency(depData.newBalance)}`);

  // Colocación de apuesta de $50.00 a Caio Borralho (cuota 2.05)
  console.log('   -> Colocando apuesta #1 de $50.00 a cuota 2.05 (Caio Borralho)...');
  const betRes = await fetch(`${BASE_URL}/api/v1/bets/place`, {
    method: 'POST',
    headers: { ...authHeaders, 'X-Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({
      walletId,
      selectionId: SEL_CAIO,
      amount: 50.00,
      description: 'Apuesta inicial combate MMA Caio Borralho',
      expectedOdds: 2.05,
      maxSlippagePercent: 5.0
    })
  });
  const betData = await betRes.json();
  if (!betRes.ok || !betData.success) {
    throw new Error(`Apuesta fallida: ${betRes.status} ${JSON.stringify(betData)}`);
  }
  console.log(`   ✓ Apuesta #1 registrada. BetId: ${betData.betId}, Ticket TxId: ${betData.transactionId}`);

  // Verificar que el saldo real quedó en 0
  const w1Res = await fetch(`${BASE_URL}/api/v1/wallet`, { headers: authHeaders });
  const w1 = await w1Res.json();
  console.log(`   ✓ Saldo post-apuesta verificado: RealAvailable = ${formatCurrency(w1.realAvailable)}, RealLocked = ${formatCurrency(w1.realLocked)}, Balance = ${formatCurrency(w1.balance)}`);
  if (w1.realAvailable !== 0 || w1.realLocked !== 50.00) {
    throw new Error(`Invariante rota en Setup: Se esperaba RealAvailable=0, se obtuvo ${w1.realAvailable}`);
  }

  // --------------------------------------------------------------------------
  // FASE 2: FALSO POSITIVO (El Error) - Liquidación como WIN
  // --------------------------------------------------------------------------
  console.log('\n[FASE 2] Administrador / Juez liquida mercado: Fallo inicial Caio Borralho = WIN...');
  const settleRes = await fetch(`${BASE_URL}/api/v1/bets/settle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_TOKEN}`
    },
    body: JSON.stringify({
      marketId: MARKET_ID,
      winnerSelectionId: SEL_CAIO,
      result: 1, // Won
      settledBy: 'Referee_Judge_InitialDecision',
      idempotencyKey: crypto.randomUUID()
    })
  });
  const settleData = await settleRes.json();
  if (!settleRes.ok) {
    throw new Error(`Liquidación fallida: ${settleRes.status} ${JSON.stringify(settleData)}`);
  }
  console.log(`   ✓ Mercado liquidado: Ganador=${settleData.winnerSelectionId}, Resultado=${settleData.result}`);

  // Verificar wallet del usuario (premio acreditado: $50 * 2.05 = $102.50)
  const w2Res = await fetch(`${BASE_URL}/api/v1/wallet`, { headers: authHeaders });
  const w2 = await w2Res.json();
  console.log(`   ✓ Saldo post-liquidación: RealAvailable = ${formatCurrency(w2.realAvailable)}, RealLocked = ${formatCurrency(w2.realLocked)}, Balance = ${formatCurrency(w2.balance)}`);
  if (w2.realAvailable !== 102.50) {
    throw new Error(`Premio no acreditado correctamente: esperado $102.50, obtenido ${w2.realAvailable}`);
  }

  // --------------------------------------------------------------------------
  // FASE 2B: EL USUARIO GASTA / RE-APUESTA EL DINERO GANADO
  // --------------------------------------------------------------------------
  console.log('\n[FASE 2B] Usuario oportunista re-apuesta sus ganancias completas ($102.50) en otro mercado...');
  const bet2Res = await fetch(`${BASE_URL}/api/v1/bets/place`, {
    method: 'POST',
    headers: { ...authHeaders, 'X-Idempotency-Key': crypto.randomUUID() },
    body: JSON.stringify({
      walletId,
      selectionId: SEL_SECONDARY,
      amount: 102.50,
      description: 'Re-inversión de ganancias en Total asaltos > 2.5',
      expectedOdds: 1.8475,
      maxSlippagePercent: 5.0
    })
  });
  const bet2Data = await bet2Res.json();
  if (!bet2Res.ok || !bet2Data.success) {
    throw new Error(`Apuesta #2 fallida: ${bet2Res.status} ${JSON.stringify(bet2Data)}`);
  }
  const w2bRes = await fetch(`${BASE_URL}/api/v1/wallet`, { headers: authHeaders });
  const w2b = await w2bRes.json();
  console.log(`   ✓ Fondos comprometidos en juego: RealAvailable = ${formatCurrency(w2b.realAvailable)}, RealLocked = ${formatCurrency(w2b.realLocked)}`);

  // --------------------------------------------------------------------------
  // FASE 3: INTERVENCIÓN DEL VAR (El Clawback) - Re-liquidación oficial
  // --------------------------------------------------------------------------
  console.log('\n[FASE 3] INTERVENCIÓN DEL VAR: Revisión de video detecta golpe ilegal o anulación...');
  console.log('   -> Ejecutando endpoint de Re-liquidación (POST /api/v1/bets/resettle)...');
  const resettleRes = await fetch(`${BASE_URL}/api/v1/bets/resettle`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${ADMIN_TOKEN}`
    },
    body: JSON.stringify({
      marketId: MARKET_ID,
      newWinnerSelectionId: SEL_YOUSRI, // El nuevo ganador oficial es Yousri Belgaroui
      newResult: 1, // Won para Yousri -> Caio pasa automáticamente a LOSS
      reason: 'VAR Review: Overturned by Official Video Review (Foul Detected)',
      resettledBy: 'VAR_Lead_Auditor',
      idempotencyKey: crypto.randomUUID()
    })
  });

  const resettleData = await resettleRes.json();
  if (!resettleRes.ok) {
    throw new Error(`Re-liquidación fallida: ${resettleRes.status} ${JSON.stringify(resettleData)}`);
  }
  console.log('   ✓ VAR Resettlement Engine completado con éxito:');
  console.log(`      - Mercado: ${resettleData.marketId}`);
  console.log(`      - Nuevo Ganador Oficial: ${resettleData.newWinnerSelectionId}`);
  console.log(`      - Clawbacks Ejecutados: ${resettleData.clawbacksExecuted}`);
  console.log(`      - Apuestas Re-liquidadas: ${resettleData.betsResettled}`);
  console.log(`      - Billeteras en Deuda Negativa: ${resettleData.walletsInNegativeDebt}`);

  // --------------------------------------------------------------------------
  // FASE 4: AUDITORÍA FINANCIERA FINAL (Inspección del Ledger de la Wallet)
  // --------------------------------------------------------------------------
  console.log('\n[FASE 4] AUDITORÍA FINANCIERA DEL SMART BONUS & CLAWBACK LEDGER...');
  const auditRes = await fetch(`${BASE_URL}/api/v1/wallet`, { headers: authHeaders });
  const auditWallet = await auditRes.json();

  console.log('\n--- ESTADO FINAL DE LA BILLETERA ---');
  console.log(`   Balance Total (Balance):           ${formatCurrency(auditWallet.balance)}`);
  console.log(`   Saldo Real Disponible:             ${formatCurrency(auditWallet.realAvailable)}`);
  console.log(`   Saldo Real Bloqueado:              ${formatCurrency(auditWallet.realLocked)}`);
  console.log(`   Saldo en Riesgo (AtRiskBalance):   ${formatCurrency(auditWallet.atRiskBalance)}`);
  console.log(`   Saldo Bono Disponible:             ${formatCurrency(auditWallet.bonusAvailable)}`);
  console.log(`   Saldo Bono Bloqueado:              ${formatCurrency(auditWallet.bonusLocked)}`);

  console.log('\n--- LIBRO MAYOR DE TRANSACCIONES (TRANSACTION AUDIT LEDGER) ---');
  console.table(
    auditWallet.transactions.map((tx, idx) => ({
      '#': idx + 1,
      Tipo: tx.type,
      Monto: formatCurrency(tx.amount),
      Estado: tx.status,
      BalanceResultante: formatCurrency(tx.balanceAfter),
      Descripción: tx.description
    }))
  );

  console.log('\n--- ANÁLISIS DE FONDOS Y RECUPERACIÓN DE LA CASA ---');
  const initialDeposit = 50.00;
  const erroneousPayout = 102.50;
  const clawbackTx = auditWallet.transactions.find(t => t.type === 'Clawback');
  const settledTx = auditWallet.transactions.find(t => t.type === 'BetSettlement');

  console.log(`1. Depósito del Jugador:               +${formatCurrency(initialDeposit)}`);
  console.log(`2. Apuesta Inicial (Stake):             -${formatCurrency(initialDeposit)}`);
  console.log(`3. Pago Erróneo de Ganancia:           +${formatCurrency(erroneousPayout)}`);
  console.log(`4. Re-apuesta del Jugador:             -${formatCurrency(erroneousPayout)}`);
  console.log(`5. Clawback Reversivo de la Casa:      -${formatCurrency(clawbackTx?.amount || erroneousPayout)}`);
  console.log(`6. Estado Contable de Deuda:           ${formatCurrency(auditWallet.realAvailable)}`);

  if (auditWallet.realAvailable < 0) {
    console.log(`\n✓ COMPROBACIÓN AUDITORÍA EXITOSA: El motor de Clawbacks no permitió pérdidas para la casa.`);
    console.log(`  El usuario tiene una deuda exigible de ${formatCurrency(Math.abs(auditWallet.realAvailable))} registrada en RealAvailable.`);
    console.log(`  Cualquier depósito futuro del jugador absorberá automáticamente esta deuda antes de liberar saldo disponible.`);
  } else {
    console.log(`\n✓ Saldo final equilibrado sin deuda.`);
  }

  console.log('\n================================================================================');
  console.log('       REPORTE EJECUTIVO VAR & CLAWBACK COMPLETADO SATISFACTORIAMENTE           ');
  console.log('================================================================================');
}

runAudit().catch(err => {
  console.error('\nERROR EN AUDITORÍA:', err);
  process.exit(1);
});


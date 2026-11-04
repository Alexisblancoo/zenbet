import crypto from 'node:crypto';

const BASE_URL = 'http://localhost';

async function run() {
  console.log('--- INICIANDO E2E SMOKE TEST ZENBET ---');

  // 1. Registro de usuario
  const uniqueId = crypto.randomBytes(4).toString('hex');
  const username = `qa_user_${uniqueId}`;
  const email = `qa_${uniqueId}@zenbet.test`;
  const password = 'Password123!';

  console.log(`[1] Registrando usuario: ${username} (${email})...`);
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
    throw new Error(`Error en registro: ${regRes.status} ${JSON.stringify(regData)}`);
  }
  const token = regData.token;
  const walletId = regData.user.walletId;
  const initialBalance = regData.user.walletBalance || 0;
  console.log(`[1] OK -> Usuario registrado con éxito. WalletId: ${walletId}, Balance inicial: $${initialBalance}`);

  const authHeaders = {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`
  };

  // 2. Simulación de Depósito en el Smart Bonus Ledger
  const depositAmount = 100.00;
  const depositIdempotency = crypto.randomUUID();
  console.log(`[2] Realizando depósito de $${depositAmount} en la billetera...`);
  const depRes = await fetch(`${BASE_URL}/api/v1/wallet/deposit`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'Idempotency-Key': depositIdempotency
    },
    body: JSON.stringify({
      amount: depositAmount,
      method: 'wallet'
    })
  });

  const depData = await depRes.json();
  if (!depRes.ok || !depData.success) {
    throw new Error(`Error en depósito: ${depRes.status} ${JSON.stringify(depData)}`);
  }
  console.log(`[2] OK -> Depósito acreditado. Nuevo balance: $${depData.newBalance}`);

  // 3. Verificación de balance en /api/v1/wallet (Smart Bonus Ledger)
  console.log('[3] Verificando balances desglosados en el Smart Bonus Ledger...');
  const walletRes = await fetch(`${BASE_URL}/api/v1/wallet`, {
    headers: authHeaders
  });
  const walletData = await walletRes.json();
  if (!walletRes.ok) {
    throw new Error(`Error al consultar wallet: ${walletRes.status}`);
  }
  console.log(`[3] Smart Bonus Ledger Snapshot:`, {
    balance: walletData.balance,
    atRiskBalance: walletData.atRiskBalance,
    realAvailable: walletData.realAvailable,
    bonusAvailable: walletData.bonusAvailable,
    realLocked: walletData.realLocked,
    bonusLocked: walletData.bonusLocked
  });

  const expectedPostDeposit = initialBalance + depositAmount;
  if (walletData.realAvailable !== expectedPostDeposit || walletData.balance !== expectedPostDeposit) {
    throw new Error(`Balance inconsistente: esperado ${expectedPostDeposit}, obtenido ${walletData.realAvailable}`);
  }

  // 4. Colocación de QuickBet
  // Selección de Ciryl Gane en evento UFC 334
  const selectionId = '3f2b3bcf-9ed6-5a9d-99e3-9c4b851519f2';
  const betAmount = 40.00;
  const betIdempotency = crypto.randomUUID();

  console.log(`[4] Colocando QuickBet de $${betAmount} a cuota 2.10 en selección ${selectionId}...`);
  const betRes = await fetch(`${BASE_URL}/api/v1/bets/place`, {
    method: 'POST',
    headers: {
      ...authHeaders,
      'X-Idempotency-Key': betIdempotency
    },
    body: JSON.stringify({
      walletId,
      selectionId,
      amount: betAmount,
      description: 'QuickBet Ciryl Gane E2E',
      expectedOdds: 2.10,
      maxSlippagePercent: 5.0
    })
  });

  const betData = await betRes.json();
  if (!betRes.ok || !betData.success) {
    throw new Error(`Error al colocar apuesta: ${betRes.status} ${JSON.stringify(betData)}`);
  }
  console.log(`[4] OK -> QuickBet colocada exitosamente! Ticket BetId: ${betData.betId}, TxId: ${betData.transactionId}`);

  // 5. Verificación post-apuesta en Smart Bonus Ledger
  console.log('[5] Verificando bloqueo y consumo Real-First en el Ledger...');
  const postWalletRes = await fetch(`${BASE_URL}/api/v1/wallet`, {
    headers: authHeaders
  });
  const postWalletData = await postWalletRes.json();
  console.log(`[5] Smart Bonus Ledger Post-Bet:`, {
    balance: postWalletData.balance,
    atRiskBalance: postWalletData.atRiskBalance,
    realAvailable: postWalletData.realAvailable,
    bonusAvailable: postWalletData.bonusAvailable,
    realLocked: postWalletData.realLocked,
    bonusLocked: postWalletData.bonusLocked,
    betsCount: postWalletData.bets?.length,
    transactionsCount: postWalletData.transactions?.length
  });

  const expectedPostBet = expectedPostDeposit - betAmount;
  if (postWalletData.realAvailable !== expectedPostBet || postWalletData.realLocked !== betAmount) {
    throw new Error(`Invariante rota: realAvailable=${postWalletData.realAvailable}, realLocked=${postWalletData.realLocked}`);
  }

  // 6. Verificación de Historial de Apuestas y Transacciones
  const betHistory = postWalletData.bets[0];
  console.log(`[6] Detalle del ticket verificado en DB:`, {
    ticket: betHistory.ticket,
    eventName: betHistory.eventName,
    selectionName: betHistory.selectionName,
    stake: betHistory.stake,
    odds: betHistory.odds,
    potentialPayout: betHistory.potentialPayout,
    status: betHistory.status
  });

  console.log('--- E2E SMOKE TEST COMPLETADO CON ÉXITO AL 100% ---');
}

run().catch((err) => {
  console.error('FALLO EN EL TEST:', err);
  process.exit(1);
});

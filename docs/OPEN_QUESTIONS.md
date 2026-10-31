# ZenBet // Preguntas Abiertas y Fricciones (OPEN_QUESTIONS)

Este documento registra los puntos de fricción, dudas y preguntas arquitectónicas abiertas respecto a las plataformas analizadas y su integración en ZenBet.

---

## 1. Protocolo de Heartbeat y Reanudación en WebSockets
- **Pregunta:** ¿Cuál es el intervalo óptimo de Ping/Pong para mantener vivas las conexiones móviles sin drenar la batería del usuario?
- **Observación:** Digitain/Stake manejan latencias de ping de 25s a 30s. Si no hay respuesta en 10s tras el ping, el cliente asume desconexión y entra en modo `reconnecting`.
- **Propuesta de Prueba para ZenBet:** Configurar el `SignalR` client con `serverTimeoutInMilliseconds = 30000` y `keepAliveIntervalInMilliseconds = 15000`.

---

## 2. Bloqueo de Mercado durante Inferencia LLM o Decisión de VAR
- **Pregunta:** ¿Cómo debe representarse el estado transitorio donde un evento no está cancelado ni terminado, pero las apuestas están congeladas momentáneamente (ej. revisión de VAR en fútbol o detención médica en UFC)?
- **Observación:** 1xBet usa el estado `suspended` y deshabilita los botones de cuotas manteniendo el valor visual en gris con un candado.
- **Implementación en ZenBet:** Ya contemplado en el componente `FightCard` y `FootballMatchCard` mediante `data-closed={true}` y `status: 'suspended'`.

---

## 3. Umbral de Aceptación Automática de Cuotas Superiores
- **Pregunta:** ¿Debe el usuario poder configurar si acepta automáticamente cuotas mejores (ej. si apostó a 1.90 y sube a 2.05)?
- **Observación:** La mayoría de casas de nivel 1 (1xBet, Stake) incluyen un checkbox en el BetSlip: "Aceptar cualquier cambio", "Aceptar solo cuotas más altas", "Preguntar siempre".
- **Siguiente Paso:** Modelar esta preferencia en el estado de `BetSlip` de ZenBet.


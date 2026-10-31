# ZenBet // Entorno y Herramientas de Análisis de Red (ENVIRONMENT)

Este documento describe la configuración del entorno de análisis de tráfico, herramientas empleadas, proxys y directrices de ejecución segura.

---

## 1. Herramientas Instaladas y Configuradas
- **REA (Reverse Engineer Anything):** Suite local de análisis de protocolos, descompilación y evaluación de comportamiento en tiempo de ejecución.
  - Ubicación: [`.agents/skills/rea/`](file:///c:/Users/juice/zenbet/.agents/skills/rea)
  - Comandos disponibles: `/rea`, `rea-analysis-optimization`, `rea-tool-design`, `rea-ci-tests-audit`, `rea-changelog-update`.
- **cURL nativo Windows (`curl.exe`):** Empleado para la inspección de cabeceras HTTP, resolución DNS y validación de políticas CORS.
- **Node.js & TypeScript:** Node v24.21.0 con npm 11.19.0 para ejecución de scripts de parsing y validación Zod.
- **Zod & TanStack Query:** Validación en tiempo de ejecución de payloads de red en el cliente ZenBet.

---

## 2. Comandos de Inspección Estandarizados

### A. Inspección de Cabeceras de Seguridad y CORS
```bash
curl.exe -s -I --connect-timeout 5 --max-time 10 -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64)" "https://<target-domain>/endpoint"
```

### B. Descarga Aislada de Cargas Útiles (Payload Traces)
```bash
curl.exe -s --connect-timeout 5 --max-time 10 -H "Accept: application/json" -H "User-Agent: Mozilla/5.0" "https://<target-domain>/api/endpoint" -o .scratch/trace_sample.json
```

---

## 3. Políticas de Seguridad y Cumplimiento
- **Aislamiento Estricto:** Toda inspección se realiza en modo analítico de solo lectura.
- **Sin Almacenamiento de Credenciales:** Prohibido registrar contraseñas, secretos de API o tokens de usuario real en el repositorio.
- **Mitigación de Denegación de Servicio:** No realizar bucles de sondeo continuo contra endpoints de producción; utilizar pausas mínimas de 1 segundo y priorizar mocks locales para pruebas funcionales.


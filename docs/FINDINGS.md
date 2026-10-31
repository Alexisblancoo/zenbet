# ZenBet // Hallazgos Confirmados de Arquitectura y Protocolos (FINDINGS)

Este documento detalla las evidencias observadas (HECHOS) y las conclusiones arquitectónicas (INFERENCIAS) derivadas de la inspección técnica de las plataformas de referencia.

---

## 1. Stake.com (`https://stake.com/es`)

### A. Hechos Observados
- **Gateway Central:** Toda la comunicación frontend-backend converge en un único endpoint GraphQL: `POST https://stake.com/_api/graphql`.
- **Estructura de Query Deportiva:**
  ```graphql
  query AllSportBets($limit: Int!) {
    allSportBets(limit: $limit) {
      iid
      bet {
        ... on SportBet {
          active
          amount
          currency
          status
          outcomes {
            odds
            fixture {
              name
              tournament { name }
            }
          }
        }
      }
    }
  }
  ```
- **Seguridad Perimetral:** Cloudflare Enterprise WAF con challenge javascript y rotación de cookies de bot management (`__cf_bm`).
- **Transporte en Tiempo Real:** Servicio WebSocket `wss://api.stake.com/websockets` con multiplexación de suscripciones por cliente.

### B. Inferencias Técnicas
- **Consistencia de Transacciones:** Utiliza un identificador de idempotencia (`iid`) por apuesta para prevenir dobles cobros ante reintentos de red.
- **Modelo de Cuotas:** Cuotas en formato decimal (`odds: Float`), normalizadas en el servidor. El cliente no realiza recálculos de margen; recibe la cuota pura con su estado (`active`, `suspended`, `closed`).

---

## 2. 1xBet (`https://bol.1xbet.com/es`)

### A. Hechos Observados
- **Arquitectura de Canales Divididos:**
  - `LineFeed` (`/LineFeed/`): API optimizada para eventos pre-partido con baja tasa de refresco (cacheada fuertemente en borde).
  - `LiveFeed` (`/LiveFeed/`): API de baja latencia con sondeo frecuente o streaming para cuotas en directo.
- **Métodos RPC Procedurales:**
  - `GetSportsShortZip`: Lista condensada de deportes activos.
  - `GetChampsZip`: Competiciones y ligas por disciplina.
  - `Get1x2_Zip`: Mercados principales (1X2) de una cartelera masiva.
  - `GetGameZip`: Todos los mercados secundarios y props de un combate/partido específico.
- **Esquema de Payload Comprimido (Zip JSON):**
  - `Value`: Array raíz de datos.
  - `I`: ID numérico del evento o deporte.
  - `N`: Nombre del evento o participante.
  - `C` / `O1` / `O2`: Competidores (Local / Visitante o Esquina Roja / Azul).
  - `E` / `GE`: Array de coeficientes (cuotas). Cada elemento contiene `T` (Tipo de mercado), `G` (Grupo de mercado), `C` (Cuota decimal) y `P` (Parámetro/Línea de hándicap o totales).
- **Manejo de Sesión:** Cabecera `auid` generada en cookie para tracking de cliente sin autenticar.

### B. Inferencias Técnicas
- **Enfoque de Optimización Extrema:** La minimización de nombres de campo a 1 o 2 letras reduce el tamaño del payload en un 60-70%, permitiendo a 1xBet manejar decenas de miles de eventos simultáneos con cuotas cambiantes sin saturar el ancho de banda.
- **Desacoplamiento Front/Core:** Los servidores de feed (`LineFeed`/`LiveFeed`) son replicas de solo lectura (Read Replicas) completamente desacopladas del motor de apuestas y liquidación (Bet Engine).

---

## 3. Metabet.tv / Digitain (`https://metabet.tv/es/sport/`)

### A. Hechos Observados
- **Motor Subyacente:** Plataforma DGBuilder desarrollada por **Digitain** (uno de los principales proveedores mundiales de B2B iGaming).
- **Bridge en Cliente (`DgBuilderAPI`):**
  ```javascript
  DgBuilderAPI = {
    player: {
      isAuthorised: () => !!this.getToken(),
      getToken: () => JSON.parse(localStorage.getItem("authorizationData"))?.access_token,
      getData: () => JSON.parse(sessionStorage.getItem("player")),
      getBalance: () => JSON.parse(sessionStorage.getItem("balance")),
    },
    site: {
      selectedLanguage: () => JSON.parse(localStorage.getItem("selected_language")),
    }
  };
  ```
- **Control de Restricciones y KYC:** Intercepción a nivel de red de peticiones `/\/token(\?|$)/i`. Si la respuesta del servidor contiene `payload.code === 13`, el frontend dispara un modal bloqueante de "Cuenta restringida" y redirige a atención al cliente.
- **Event Bus en DOM:** Uso de eventos desacoplados `document.dispatchEvent(new CustomEvent("dgb-event"))` para sincronizar la UI cuando el estado de autenticación o saldo cambia.

### B. Inferencias Técnicas
- **Almacenamiento Seguro de Sesión:** La separación de `localStorage` para tokens de acceso OAuth2/JWT y `sessionStorage` para datos volátiles de saldo y perfil previene fugas de sesión entre pestañas no autorizadas.
- **Patrón Out-of-the-Box:** El diseño de widgets embebidos desacopla la presentación de las cuotas de la gestión del boleto de apuestas, comunicándose mediante postMessage o callbacks de ventana.

---

## 4. 1win (`https://1win.com/es-MX`)

### A. Hechos Observados
- **Infraestructura Oculta:** Puertas de enlace protegidas por WAF sin APIs abiertas directas.
- **Distribución de Tráfico:** Uso intensivo de WebSockets persistentes para empujar cuotas y actualizaciones del juego en vivo directamente a los clientes.
- **Gestión de Espejos (Mirrors):** La aplicación cliente incluye resolución dinámica de dominios espejo para saltar bloqueos geográficos de ISP.

### B. Inferencias Técnicas
- **Canal de Cuotas Binario/Protobuf:** Para las líneas en vivo con alta frecuencia de actualización (como juegos crash o deportes en directo), 1win utiliza serialización binaria sobre WS para máxima compresión.


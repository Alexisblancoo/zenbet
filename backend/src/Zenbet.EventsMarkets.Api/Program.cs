using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using FluentValidation;
using OpenTelemetry.Metrics;
using OpenTelemetry.Resources;
using OpenTelemetry.Trace;
using MediatR;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using System.Threading.RateLimiting;
using Zenbet.EventsMarkets.Api.Authentication;
using Zenbet.EventsMarkets.Api.Endpoints;
using Zenbet.EventsMarkets.Api.ExceptionHandling;
using Zenbet.EventsMarkets.Api.Hubs;
using Zenbet.EventsMarkets.Api.Services;
using Zenbet.EventsMarkets.Application.Behaviors;
using Zenbet.EventsMarkets.Application.Commands.PlaceBet;
using Zenbet.EventsMarkets.Application.Interfaces;
using Zenbet.EventsMarkets.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Hide Kestrel's Server response header; the middleware below removes headers
// that might be added by hosting integrations or application packages.
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

// Add CORS policy for local development
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",    // Vite dev server
                "http://127.0.0.1:5173",    // Vite dev server (IPv4 loopback)
                "http://localhost:3000",    // React dev server
                "http://localhost:4200",    // Angular dev server
                "http://localhost:8080",    // Vue dev server
                "https://localhost:5173",   // HTTPS variants
                "https://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials(); // Required for SignalR
    });

    options.AddPolicy("DevelopmentCors", policy =>
    {
        policy.WithOrigins(
                "http://localhost:5173",    // Vite dev server
                "http://127.0.0.1:5173",    // Vite dev server (IPv4 loopback)
                "http://localhost:3000",    // React dev server
                "http://localhost:4200",    // Angular dev server
                "http://localhost:8080",    // Vue dev server
                "https://localhost:5173",   // HTTPS variants
                "https://localhost:3000")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials(); // Required for SignalR
    });
});

// Detrás de nginx, RemoteIpAddress sería la IP del proxy para TODOS los clientes:
// el rate limit anónimo quedaría global y los logs de auditoría sin IP real.
// Solo se confía en X-Forwarded-For si llega desde una red de proxy conocida
// (por defecto redes privadas, p. ej. la red de Docker), y solo el último salto.
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor | ForwardedHeaders.XForwardedProto;
    options.ForwardLimit = 1;
    options.KnownIPNetworks.Clear();
    options.KnownProxies.Clear();

    var trusted = builder.Configuration["ForwardedHeaders:TrustedNetworks"]
        ?? "10.0.0.0/8,172.16.0.0/12,192.168.0.0/16,127.0.0.0/8,::1/128";
    foreach (var cidr in trusted.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries))
    {
        options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse(cidr));
    }
});

// Add Rate Limiting - Sliding Window policy for /api/v1/bets
builder.Services.AddRateLimiter(options =>
{
    options.AddPolicy("BettingPolicy", httpContext =>
        RateLimitPartition.GetSlidingWindowLimiter(
            partitionKey: httpContext.User?.Identity?.Name ?? httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: _ => new SlidingWindowRateLimiterOptions
            {
                PermitLimit = 5,
                Window = TimeSpan.FromSeconds(1),
                SegmentsPerWindow = 2,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
                QueueLimit = 0
            }));

    // Login/registro: frena fuerza bruta y relleno de credenciales por IP real del
    // cliente (requiere ForwardedHeaders detrás de nginx). Por defecto 10 intentos/minuto por IP;
    // configurable (RateLimiting:Auth:PermitLimit / WindowSeconds) para pruebas de carga que deben
    // sembrar cientos de usuarios desde una sola máquina. NO subirlo en producción.
    // El bloqueo por cuenta necesita columnas nuevas: ver ADR de auth.
    var authPermitLimit = Math.Max(1, builder.Configuration.GetValue<int?>("RateLimiting:Auth:PermitLimit") ?? 10);
    var authWindow = TimeSpan.FromSeconds(
        Math.Max(1, builder.Configuration.GetValue<int?>("RateLimiting:Auth:WindowSeconds") ?? 60));
    options.AddPolicy("AuthPolicy", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "anonymous",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = authPermitLimit,
                Window = authWindow,
                QueueLimit = 0
            }));

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        var problemDetails = new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = "Too Many Requests",
            Detail = "Demasiadas solicitudes. Espera un momento e inténtalo de nuevo.",
            Type = "https://tools.ietf.org/html/rfc6585#section-4",
            Instance = context.HttpContext.Request.Path
        };
        await context.HttpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);
    };
});

// Add SignalR
builder.Services.AddSignalR(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.ClientTimeoutInterval = TimeSpan.FromSeconds(30);
    options.HandshakeTimeout = TimeSpan.FromSeconds(15);
    options.KeepAliveInterval = TimeSpan.FromSeconds(10);
});

// Direccionamiento privado del hub de wallet: cada conexión se identifica con
// el claim wallet_id del token para que Clients.User solo alcance al dueño.
builder.Services.AddSingleton<Microsoft.AspNetCore.SignalR.IUserIdProvider, WalletUserIdProvider>();

// Compresión de respuesta (Brotli/Gzip): el feed de eventos/odds es JSON
// repetitivo que comprime muy bien; en conexiones móviles de LatAm el ahorro
// de bytes se nota directamente en el tiempo de respuesta percibido.
builder.Services.AddResponseCompression(options =>
{
    options.EnableForHttps = true;
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.BrotliCompressionProvider>();
    options.Providers.Add<Microsoft.AspNetCore.ResponseCompression.GzipCompressionProvider>();
});

// Add ProblemDetails for standardized error responses
builder.Services.AddProblemDetails(options =>
{
    options.CustomizeProblemDetails = context =>
    {
        context.ProblemDetails.Instance = context.HttpContext.Request.Path;
        context.ProblemDetails.Extensions["traceId"] = context.HttpContext.TraceIdentifier;
    };
});

// Add Exception Handler
builder.Services.AddExceptionHandler<GlobalExceptionHandler>();

builder.Services.AddValidatorsFromAssemblyContaining<PlaceBetCommandValidator>();
builder.Services.AddValidatorsFromAssemblyContaining<PlaceBetRequestValidator>();
builder.Services.AddTransient(typeof(IPipelineBehavior<,>), typeof(ValidationBehavior<,>));

// Observabilidad mínima viable: tracing + métricas de ASP.NET Core y
// HttpClient. Siempre exporta a consola (gratis, sin infraestructura nueva);
// si OTEL_EXPORTER_OTLP_ENDPOINT está configurado, además exporta OTLP hacia
// un collector real (Grafana/Jaeger/etc.) sin cambiar código.
var otlpEndpoint = builder.Configuration["OTEL_EXPORTER_OTLP_ENDPOINT"]
    ?? Environment.GetEnvironmentVariable("OTEL_EXPORTER_OTLP_ENDPOINT");
builder.Services.AddOpenTelemetry()
    .ConfigureResource(resource => resource.AddService("zenbet-api"))
    .WithTracing(tracing =>
    {
        tracing.AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddConsoleExporter();

        if (!string.IsNullOrWhiteSpace(otlpEndpoint))
        {
            tracing.AddOtlpExporter();
        }
    })
    .WithMetrics(metrics =>
    {
        metrics.AddAspNetCoreInstrumentation()
            .AddHttpClientInstrumentation()
            .AddRuntimeInstrumentation();

        if (!string.IsNullOrWhiteSpace(otlpEndpoint))
        {
            metrics.AddOtlpExporter();
        }
    });

builder.Services.AddInfrastructure(builder.Configuration);

// Sesión de jugador: token HMAC emitido por /api/auth y validado en cada request.
builder.Services.AddAuthentication(BearerTokenAuthenticationHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, BearerTokenAuthenticationHandler>(
        BearerTokenAuthenticationHandler.SchemeName,
        _ => { });
builder.Services.AddAuthorization(options =>
{
    // Operaciones que mueven dinero o cuotas: solo sesión autenticada con rol admin.
    options.AddPolicy(AdminAccess.PolicyName, policy => policy
        .RequireAuthenticatedUser()
        .RequireRole(AdminAccess.Role));
});

builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
    cfg.RegisterServicesFromAssembly(typeof(Zenbet.EventsMarkets.Application.Queries.GetEvents.GetEventsQuery).Assembly);
});

// Override notification service with SignalR implementation
builder.Services.AddScoped<INotificationService, SignalRNotificationService>();

// RGS Seamless Wallet options & MVC Controllers
builder.Services.Configure<RgsOptions>(builder.Configuration.GetSection(RgsOptions.SectionName));
builder.Services.AddControllers();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    var xmlFilename = $"{System.Reflection.Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFilename);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath, includeControllerXmlComments: true);
    }
});

var app = builder.Build();

// Fail-fast fuera de Development: nunca arrancar con los secretos de ejemplo
// de .env.example/docker-compose.yml, ni con una clave de firma demasiado corta.
if (!app.Environment.IsDevelopment())
{
    const string knownExampleSigningKey = "e8e72c60620f262e75cdacfa004fa1cc59b4ff14435a225c54deff7a6c676359";
    const string knownExampleRgsSecret = "zenbet-rgs-hmac-sha256-shared-secret-key-2026";

    var signingKey = app.Configuration["Auth:SigningKey"];
    var rgsSecret = app.Configuration["Rgs:SharedSecret"];

    var startupErrors = new List<string>();
    if (string.IsNullOrWhiteSpace(signingKey) || signingKey.Length < 32)
    {
        startupErrors.Add("Auth:SigningKey falta o tiene menos de 32 caracteres.");
    }
    else if (signingKey == knownExampleSigningKey)
    {
        startupErrors.Add("Auth:SigningKey sigue siendo el valor de ejemplo de .env.example/docker-compose.yml.");
    }

    // RGS firma callbacks que acreditan premios: un secreto público permite falsificarlos.
    if (string.IsNullOrWhiteSpace(rgsSecret) || rgsSecret.Length < 32)
    {
        startupErrors.Add("Rgs:SharedSecret falta o tiene menos de 32 caracteres.");
    }
    else if (rgsSecret == knownExampleRgsSecret)
    {
        startupErrors.Add("Rgs:SharedSecret sigue siendo el valor de ejemplo versionado en appsettings.");
    }

    if (startupErrors.Count > 0)
    {
        throw new InvalidOperationException(
            "Arranque abortado fuera de Development por secretos inseguros: " +
            string.Join(" ", startupErrors) +
            " Genera valores nuevos (ej. `openssl rand -hex 32`) y defínelos en el entorno real.");
    }
}

// Primero: resolver la IP/esquema reales del cliente antes de rate limit, auth y logs.
app.UseForwardedHeaders();

// Apply Exception Handler first
app.UseExceptionHandler();

app.Use(async (context, next) =>
{
    context.Response.OnStarting(() =>
    {
        context.Response.Headers.Remove("Server");
        context.Response.Headers.Remove("X-Powered-By");
        context.Response.Headers.Remove("X-AspNet-Version");
        context.Response.Headers.Remove("X-AspNetMvc-Version");
        context.Response.Headers.Remove("X-Framework-Version");
        context.Response.Headers.Remove("X-Runtime");
        context.Response.Headers.Remove("X-Generator");

        // Cabeceras de seguridad básicas. CSP se deja fuera deliberadamente:
        // Swagger UI usa scripts inline y una CSP estricta lo rompe; la CSP del
        // frontend se define en nginx (ver Roadmap).
        context.Response.Headers["X-Content-Type-Options"] = "nosniff";
        context.Response.Headers["X-Frame-Options"] = "DENY";
        context.Response.Headers["Referrer-Policy"] = "strict-origin-when-cross-origin";
        if (context.Request.IsHttps)
        {
            context.Response.Headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains";
        }

        return Task.CompletedTask;
    });

    await next();
});

app.UseResponseCompression();

// Explicit Routing must precede CORS for endpoint-specific policies
app.UseRouting();

// Apply CORS before Authentication and Authorization
app.UseCors("DevelopmentCors");

// La identidad se resuelve antes del rate limit para particionar por jugador.
app.UseAuthentication();
app.UseAuthorization();

// Validación criptográfica HMAC-SHA256 para pasarela RGS (/api/rgs/*)
app.UseMiddleware<RgsAuthenticationMiddleware>();

// Apply Rate Limiting
app.UseRateLimiter();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHttpsRedirection();
}

// Map SignalR hubs with CORS policy and no rate limiting
app.MapHub<OddsHub>("/odds-hub").RequireCors("DevelopmentCors").DisableRateLimiting();
app.MapHub<FightHub>("/fight-hub").RequireCors("DevelopmentCors").DisableRateLimiting();
app.MapHub<FootballHub>("/football-hub").RequireCors("DevelopmentCors").DisableRateLimiting();
app.MapHub<WalletHub>("/wallet-hub").RequireCors("DevelopmentCors").DisableRateLimiting().RequireAuthorization();

// Los grupos de endpoints declaran su propio prefijo y sus políticas. No
// envolverlos con otro MapGroup: eso duplicaba /api/v1/bets en la ruta real.
app.MapAuthEndpoints();
app.MapBetsEndpoints();
app.MapAdminMarketsEndpoints();
app.MapWalletEndpoints();
app.MapEventsEndpoints();
app.MapPromotionsEndpoints();
app.MapUpcomingEventsEndpoint();
app.MapFootballEndpoints();
app.MapFightersEndpoints();
app.MapControllers();

app.MapGet("/health", () => Results.Ok(new { status = "healthy", timestamp = DateTimeOffset.UtcNow }));
app.MapGet("/healthz", () => Results.Ok(new { status = "healthy", timestamp = DateTimeOffset.UtcNow }));

app.Run();

using Microsoft.AspNetCore.Authentication;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using FluentValidation;
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
using Zenbet.EventsMarkets.Domain.Exceptions;
using Zenbet.EventsMarkets.Infrastructure;

var builder = WebApplication.CreateBuilder(args);

// Hide Kestrel's Server response header; the middleware below removes headers
// that might be added by hosting integrations or application packages.
builder.WebHost.ConfigureKestrel(options => options.AddServerHeader = false);

// Add CORS policy for local development
builder.Services.AddCors(options =>
{
    options.AddPolicy("DevelopmentCors", policy =>
    {
        policy.WithOrigins(
                "http://localhost:3000",    // React dev server
                "http://localhost:5173",    // Vite dev server
                "http://127.0.0.1:5173",    // Vite dev server (IPv4 loopback)
                "http://localhost:4200",    // Angular dev server
                "http://localhost:8080",    // Vue dev server
                "https://localhost:3000",   // HTTPS variants
                "https://localhost:5173",
                "https://localhost:4200",
                "https://localhost:8080")
            .AllowAnyHeader()
            .AllowAnyMethod()
            .AllowCredentials(); // Required for SignalR
    });
});

// Add Rate Limiting - Sliding Window policy for /api/v1/bets
builder.Services.AddRateLimiter(options =>
{
    options.GlobalLimiter = PartitionedRateLimiter.Create<HttpContext, string>(httpContext =>
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

    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.OnRejected = async (context, cancellationToken) =>
    {
        context.HttpContext.Response.StatusCode = StatusCodes.Status429TooManyRequests;
        var problemDetails = new Microsoft.AspNetCore.Mvc.ProblemDetails
        {
            Status = StatusCodes.Status429TooManyRequests,
            Title = "Too Many Requests",
            Detail = "Rate limit exceeded. Maximum 5 requests per second allowed.",
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

builder.Services.AddInfrastructure(builder.Configuration);

// Sesión de jugador: token HMAC emitido por /api/auth y validado en cada request.
builder.Services.AddAuthentication(BearerTokenAuthenticationHandler.SchemeName)
    .AddScheme<AuthenticationSchemeOptions, BearerTokenAuthenticationHandler>(
        BearerTokenAuthenticationHandler.SchemeName,
        _ => { });
builder.Services.AddAuthorization();

builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(Program).Assembly);
    cfg.RegisterServicesFromAssembly(typeof(Zenbet.EventsMarkets.Application.Queries.GetEvents.GetEventsQuery).Assembly);
});

// Override notification service with SignalR implementation
builder.Services.AddScoped<INotificationService, SignalRNotificationService>();

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

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
        return Task.CompletedTask;
    });

    await next();
});

// Apply CORS before other middleware
app.UseCors("DevelopmentCors");

// Apply Exception Handler before other middleware
app.UseExceptionHandler();

// La identidad se resuelve antes del rate limit para particionar por jugador.
app.UseAuthentication();

// Apply Rate Limiting
app.UseRateLimiter();

app.UseAuthorization();

if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI();
}
else
{
    app.UseHttpsRedirection();
}

// Map SignalR hubs
app.MapHub<OddsHub>("/odds-hub");
app.MapHub<FightHub>("/fight-hub");
app.MapHub<FootballHub>("/football-hub");
app.MapHub<WalletHub>("/wallet-hub").RequireAuthorization();

// Los grupos de endpoints declaran su propio prefijo y sus políticas. No
// envolverlos con otro MapGroup: eso duplicaba /api/v1/bets en la ruta real.
app.MapAuthEndpoints();
app.MapBetsEndpoints();
app.MapWalletEndpoints();
app.MapEventsEndpoints();
app.MapPromotionsEndpoints();
app.MapUpcomingEventsEndpoint();
app.MapFootballEndpoints();
app.MapFightersEndpoints();

app.MapGet("/health", () => Results.Ok(new { status = "healthy" }));

app.Run();

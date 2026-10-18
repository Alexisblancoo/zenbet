using Zenbet.Api.Data;
using Zenbet.Api.Engines;

var builder = WebApplication.CreateBuilder(args);

// 1. Configuración de Controladores y Formateo JSON
builder.Services.AddControllers();

// 2. Configuración de Swagger / OpenAPI para documentación interactiva
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new Microsoft.OpenApi.Models.OpenApiInfo
    {
        Title = "Zenbet Financial & Betting Web API",
        Version = "v1",
        Description = "Motor financiero de alta concurrencia con transacciones ACID en PostgreSQL, Shadow-Banning algorítmico y Ledger inmutable."
    });
});

// 3. Inyección de Dependencias (DI) para Capa de Datos y Motores
builder.Services.AddSingleton<DbConnectionFactory>();
builder.Services.AddScoped<IShadowBanningEngine, ShadowBanningEngine>();
builder.Services.AddScoped<IBetEngine, BetEngine>();
builder.Services.AddScoped<DbInitializer>();

// 4. Configuración de Política de CORS abierta para 'http://localhost:5173'
builder.Services.AddCors(options =>
{
    options.AddPolicy("ZenbetCorsPolicy", policy =>
    {
        policy.WithOrigins("http://localhost:5173")
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

var app = builder.Build();

// 5. Autoinicialización de la base de datos PostgreSQL (Tablas, Claves foráneas, Índices)
using (var scope = app.Services.CreateScope())
{
    var initializer = scope.ServiceProvider.GetRequiredService<DbInitializer>();
    await initializer.InitializeDatabaseAsync();
}

// 6. Configuración de Pipeline HTTP
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(c =>
    {
        c.SwaggerEndpoint("/swagger/v1/swagger.json", "Zenbet API v1");
        c.RoutePrefix = "swagger";
    });
}

// Aplicar política de CORS
app.UseCors("ZenbetCorsPolicy");

app.UseAuthorization();

app.MapControllers();

app.Run();

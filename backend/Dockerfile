# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# Build stage: restore first with only project metadata, then publish.
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

COPY ["global.json", "./"]
COPY ["Directory.Build.props", "./"]
COPY ["src/Zenbet.EventsMarkets.Domain/Zenbet.EventsMarkets.Domain.csproj", "src/Zenbet.EventsMarkets.Domain/"]
COPY ["src/Zenbet.EventsMarkets.Application/Zenbet.EventsMarkets.Application.csproj", "src/Zenbet.EventsMarkets.Application/"]
COPY ["src/Zenbet.EventsMarkets.Infrastructure/Zenbet.EventsMarkets.Infrastructure.csproj", "src/Zenbet.EventsMarkets.Infrastructure/"]
COPY ["src/Zenbet.EventsMarkets.Api/Zenbet.EventsMarkets.Api.csproj", "src/Zenbet.EventsMarkets.Api/"]

RUN dotnet restore "src/Zenbet.EventsMarkets.Api/Zenbet.EventsMarkets.Api.csproj"

COPY ["src/", "src/"]
WORKDIR "/src/src/Zenbet.EventsMarkets.Api"

RUN dotnet publish "Zenbet.EventsMarkets.Api.csproj" \
    -c Release \
    -o /app/publish \
    --no-restore \
    /p:UseAppHost=false

# ---------------------------------------------------------------------------
# Runtime stage: minimal ASP.NET image and non-root user.
# ---------------------------------------------------------------------------
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS final
WORKDIR /app

ENV ASPNETCORE_URLS=http://+:5000 \
    ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_EnableDiagnostics=0

EXPOSE 5000

COPY --from=build --chown=app:app /app/publish .

USER app

ENTRYPOINT ["dotnet", "Zenbet.EventsMarkets.Api.dll"]

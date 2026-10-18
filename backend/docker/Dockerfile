# Build stage
FROM mcr.microsoft.com/dotnet/sdk:10.0-alpine AS build
WORKDIR /src

# Copy solution file and CPM configs first to leverage Docker layer caching
COPY ["Zenbet.EventsMarkets.sln", "./"]
COPY ["Directory.Build.props", "./"]
COPY ["global.json", "./"]
COPY ["src/Zenbet.EventsMarkets.Domain/Zenbet.EventsMarkets.Domain.csproj", "src/Zenbet.EventsMarkets.Domain/"]
COPY ["src/Zenbet.EventsMarkets.Application/Zenbet.EventsMarkets.Application.csproj", "src/Zenbet.EventsMarkets.Application/"]
COPY ["src/Zenbet.EventsMarkets.Infrastructure/Zenbet.EventsMarkets.Infrastructure.csproj", "src/Zenbet.EventsMarkets.Infrastructure/"]
COPY ["src/Zenbet.EventsMarkets.Api/Zenbet.EventsMarkets.Api.csproj", "src/Zenbet.EventsMarkets.Api/"]

RUN dotnet restore "Zenbet.EventsMarkets.sln"

COPY . .
WORKDIR "/src/src/Zenbet.EventsMarkets.Api"
RUN dotnet publish "Zenbet.EventsMarkets.Api.csproj" -c Release -o /app/publish --no-restore

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:10.0-alpine AS final
WORKDIR /app
EXPOSE 8080

RUN apk add --no-cache curl

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "Zenbet.EventsMarkets.Api.dll"]
# Backend tests

Run only the fast unit-test project locally with:

```powershell
dotnet test tests/Zenbet.EventsMarkets.Unit.Tests/Zenbet.EventsMarkets.Unit.Tests.csproj -c Release
```

`Zenbet.EventsMarkets.Unit.Tests` contains tests that use domain logic and pure application helpers; it does not start Docker or PostgreSQL.

`Zenbet.EventsMarkets.Integration.Tests` contains the PostgreSQL/Testcontainers fixtures and is intentionally excluded from the solution. CI runs that project in its PostgreSQL integration step; it is not part of the local test command.

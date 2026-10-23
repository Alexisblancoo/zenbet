namespace Zenbet.EventsMarkets.Api.Endpoints;

using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.RateLimiting;
using Zenbet.EventsMarkets.Application.Auth;
using Zenbet.EventsMarkets.Application.Interfaces;

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth")
            .WithTags("Auth")
            .RequireRateLimiting("BettingPolicy");

        group.MapPost("/register", async (
            AuthRegisterRequest request,
            IAuthService authService,
            CancellationToken cancellationToken) =>
        {
            var result = await authService.RegisterAsync(request, cancellationToken);

            if (result.Succeeded)
            {
                return Results.Created("/api/auth/session", result.Session);
            }

            if (result.FieldErrors.Count > 0)
            {
                return Results.ValidationProblem(
                    result.FieldErrors,
                    detail: result.Error,
                    statusCode: StatusCodes.Status422UnprocessableEntity,
                    title: "Revisa los datos de tu cuenta");
            }

            return Results.Problem(
                statusCode: StatusCodes.Status409Conflict,
                title: "No pudimos crear la cuenta",
                detail: result.Error);
        })
        .AllowAnonymous()
        .WithName("RegisterPlayer")
        .Produces<AuthSessionDto>(StatusCodes.Status201Created)
        .ProducesValidationProblem(StatusCodes.Status422UnprocessableEntity)
        .ProducesProblem(StatusCodes.Status409Conflict)
        .Produces(StatusCodes.Status429TooManyRequests);

        group.MapPost("/login", async (
            AuthLoginRequest request,
            IAuthService authService,
            CancellationToken cancellationToken) =>
        {
            var result = await authService.LoginAsync(request, cancellationToken);

            if (result.Succeeded)
            {
                return Results.Ok(result.Session);
            }

            if (result.FieldErrors.Count > 0)
            {
                return Results.ValidationProblem(
                    result.FieldErrors,
                    detail: result.Error,
                    statusCode: StatusCodes.Status422UnprocessableEntity,
                    title: "Revisa tus credenciales");
            }

            return Results.Problem(
                statusCode: StatusCodes.Status401Unauthorized,
                title: "No pudimos iniciar sesión",
                detail: result.Error);
        })
        .AllowAnonymous()
        .WithName("LoginPlayer")
        .Produces<AuthSessionDto>(StatusCodes.Status200OK)
        .ProducesProblem(StatusCodes.Status401Unauthorized)
        .Produces(StatusCodes.Status429TooManyRequests);
    }
}

using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
using Npgsql;
using Zenbet.EventsMarkets.Domain.Exceptions;

namespace Zenbet.EventsMarkets.Api.ExceptionHandling;

public sealed class GlobalExceptionHandler : IExceptionHandler
{
    private readonly ILogger<GlobalExceptionHandler> _logger;

    public GlobalExceptionHandler(ILogger<GlobalExceptionHandler> logger)
    {
        _logger = logger;
    }

    public async ValueTask<bool> TryHandleAsync(
        HttpContext httpContext,
        Exception exception,
        CancellationToken cancellationToken)
    {
        if (exception is FluentValidation.ValidationException validationException)
        {
            var errors = validationException.Errors
                .GroupBy(failure => failure.PropertyName)
                .ToDictionary(group => group.Key, group => group.Select(failure => failure.ErrorMessage).ToArray());
            var validationDetails = new ValidationProblemDetails(errors)
            {
                Status = StatusCodes.Status400BadRequest,
                Title = "One or more validation errors occurred.",
                Instance = httpContext.Request.Path
            };
            validationDetails.Extensions["traceId"] = httpContext.TraceIdentifier;
            httpContext.Response.StatusCode = StatusCodes.Status400BadRequest;
            httpContext.Response.ContentType = "application/problem+json";
            await httpContext.Response.WriteAsJsonAsync(validationDetails, cancellationToken);
            return true;
        }

        var (statusCode, title, detail, type) = MapException(exception);

        _logger.LogWarning(exception, "Exception handled: {ExceptionType} - {Message}", exception.GetType().Name, exception.Message);

        var problemDetails = new ProblemDetails
        {
            Status = statusCode,
            Title = title,
            Detail = detail,
            Type = type,
            Instance = httpContext.Request.Path
        };

        problemDetails.Extensions["traceId"] = httpContext.TraceIdentifier;

        if (statusCode == StatusCodes.Status503ServiceUnavailable)
        {
            // Saturación transitoria: nada se registró y reintentar con la MISMA clave de idempotencia es seguro.
            var retryAfter = exception is ServiceBusyException busy ? busy.RetryAfterSeconds : 1;
            httpContext.Response.Headers.RetryAfter = retryAfter.ToString(System.Globalization.CultureInfo.InvariantCulture);
            problemDetails.Extensions["code"] = "SERVICE_BUSY";
        }

        httpContext.Response.StatusCode = statusCode;
        httpContext.Response.ContentType = "application/problem+json";

        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);
        return true;
    }

    /// <summary>
    /// Contención transitoria de PostgreSQL: lock no obtenido a tiempo (55P03), consulta cancelada (57014) o
    /// comando expirado. No son errores del servidor en sentido estricto: el cliente debe reintentar.
    /// </summary>
    internal static bool IsTransientDatabaseContention(Exception exception)
    {
        for (var current = exception; current is not null; current = current.InnerException)
        {
            if (current is PostgresException { SqlState: "55P03" or "57014" })
            {
                return true;
            }

            if (current is NpgsqlException { InnerException: TimeoutException })
            {
                return true;
            }
        }

        return false;
    }

    private static (int StatusCode, string Title, string Detail, string Type) MapException(Exception exception)
    {
        if (IsTransientDatabaseContention(exception))
        {
            return (StatusCodes.Status503ServiceUnavailable,
                "Servicio ocupado",
                "El sistema está ocupado. Tu operación no se registró; inténtalo de nuevo con la misma clave.",
                "https://tools.ietf.org/html/rfc9110#section-15.6.4");
        }

        return exception switch
        {
            ServiceBusyException ex => (StatusCodes.Status503ServiceUnavailable,
                "Servicio ocupado",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.6.4"),

            InvalidPricingException ex => (StatusCodes.Status422UnprocessableEntity,
                "Cotización inválida",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.22"),

            MarketOpeningRejectedException ex => (StatusCodes.Status422UnprocessableEntity,
                "No se pueden abrir mercados",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.22"),

            IdempotencyConflictException ex => (StatusCodes.Status409Conflict,
                "Idempotency-Key conflict",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.10"),

            InsufficientFundsException ex => (StatusCodes.Status422UnprocessableEntity,
                "Insufficient Funds",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.22"),

            WalletNotFoundException ex => (StatusCodes.Status404NotFound,
                "Wallet Not Found",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.5"),

            MarketNotFoundException ex => (StatusCodes.Status404NotFound,
                "Market Not Found",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.5"),

            SelectionNotFoundException ex => (StatusCodes.Status404NotFound,
                "Selection Not Found",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.5"),

            TransactionNotFoundException ex => (StatusCodes.Status404NotFound,
                "Transaction Not Found",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.5"),

            EventNotFoundException ex => (StatusCodes.Status404NotFound,
                "Event Not Found",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.5"),

            MaxUserBetLimitExceededException ex => (StatusCodes.Status422UnprocessableEntity,
                "Maximum User Bet Limit Exceeded",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.22"),

            MaxMarketExposureExceededException ex => (StatusCodes.Status422UnprocessableEntity,
                "Maximum Market Exposure Limit Exceeded",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.22"),

            RiskLimitExceededException ex => (StatusCodes.Status422UnprocessableEntity,
                "Risk Limit Exceeded",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.22"),

            MarketAlreadySettledException ex => (StatusCodes.Status409Conflict,
                "Market Already Settled",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.10"),

            InvalidTransactionAmountException ex => (StatusCodes.Status400BadRequest,
                "Invalid Transaction Amount",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.1"),

            InvalidOddsTransitionException ex => (StatusCodes.Status400BadRequest,
                "Invalid Odds Transition",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.1"),

            DivisionMismatchException ex => (StatusCodes.Status400BadRequest,
                "Invalid MMA Bout",
                ex.Message,
                "https://tools.ietf.org/html/rfc9110#section-15.5.1"),

            _ => (StatusCodes.Status500InternalServerError,
                "Internal Server Error",
                "An unexpected error occurred. Please try again later.",
                "https://tools.ietf.org/html/rfc9110#section-15.6.1")
        };
    }
}

using Microsoft.AspNetCore.Diagnostics;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Logging;
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

        httpContext.Response.StatusCode = statusCode;
        httpContext.Response.ContentType = "application/problem+json";

        await httpContext.Response.WriteAsJsonAsync(problemDetails, cancellationToken);
        return true;
    }

    private static (int StatusCode, string Title, string Detail, string Type) MapException(Exception exception)
    {
        return exception switch
        {
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

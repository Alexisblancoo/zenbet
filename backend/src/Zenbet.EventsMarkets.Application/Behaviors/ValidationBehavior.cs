namespace Zenbet.EventsMarkets.Application.Behaviors;

using FluentValidation;
using MediatR;

public sealed class ValidationBehavior<TRequest, TResponse> : IPipelineBehavior<TRequest, TResponse>
    where TRequest : IRequest<TResponse>
{
    private readonly IEnumerable<IValidator<TRequest>> _validators;

    public ValidationBehavior(IEnumerable<IValidator<TRequest>> validators) => _validators = validators;

    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var results = await Task.WhenAll(_validators.Select(validator =>
            validator.ValidateAsync(new ValidationContext<TRequest>(request), cancellationToken)));
        var failures = results.SelectMany(result => result.Errors).Where(failure => failure is not null).ToArray();
        if (failures.Length > 0)
            throw new ValidationException(failures);

        return await next();
    }
}
